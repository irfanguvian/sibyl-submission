import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type Document, Role } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/auth.types";
import { CaseAccessService } from "../cases/case-access.service";
import type { Env } from "../env";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { type AllowedMime, detectAllowedMime, safeFilename } from "./mime";

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly caseAccess: CaseAccessService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Validate size + magic bytes, then stream to object storage under a UUID key. */
  private async validateAndStore(
    file: Express.Multer.File | undefined,
  ): Promise<{ storedKey: string; mime: AllowedMime; originalName: string; size: number }> {
    if (!file?.buffer) {
      throw new BadRequestException("No file uploaded");
    }
    const max = this.config.get("MAX_UPLOAD_BYTES", { infer: true });
    if (file.size > max) {
      throw new PayloadTooLargeException("File exceeds the 10 MB limit");
    }
    const mime = detectAllowedMime(file.buffer);
    if (!mime) {
      throw new UnsupportedMediaTypeException("Unsupported file type");
    }
    const storedKey = randomUUID();
    await this.storage.put(storedKey, file.buffer, mime);
    return { storedKey, mime, originalName: safeFilename(file.originalname), size: file.size };
  }

  /** Upload a document to a case. Allowed for anyone who can view the case. */
  async uploadToCase(
    user: AuthenticatedUser,
    caseId: string,
    file: Express.Multer.File | undefined,
  ): Promise<Document> {
    await this.caseAccess.getViewableCase(user, caseId);
    const stored = await this.validateAndStore(file);
    return this.prisma.document.create({
      data: { ...stored, uploadedById: user.id, caseId },
    });
  }

  async listForCase(user: AuthenticatedUser, caseId: string): Promise<Document[]> {
    await this.caseAccess.getViewableCase(user, caseId);
    return this.prisma.document.findMany({ where: { caseId }, orderBy: { createdAt: "desc" } });
  }

  /** Upload a document to the caller's own tutor profile. */
  async uploadToOwnProfile(
    user: AuthenticatedUser,
    file: Express.Multer.File | undefined,
  ): Promise<Document> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { userId: user.id } });
    if (!profile) {
      throw new BadRequestException("Create your tutor profile before uploading documents");
    }
    const stored = await this.validateAndStore(file);
    return this.prisma.document.create({
      data: { ...stored, uploadedById: user.id, tutorProfileId: profile.id },
    });
  }

  /** List a profile's documents. Parents may view any; tutors only their own. */
  async listForProfile(user: AuthenticatedUser, profileId: string): Promise<Document[]> {
    await this.assertCanViewProfile(user, profileId);
    return this.prisma.document.findMany({
      where: { tutorProfileId: profileId },
      orderBy: { createdAt: "desc" },
    });
  }

  /** Delete a document from the caller's own profile. */
  async deleteOwnProfileDocument(user: AuthenticatedUser, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc?.tutorProfileId) {
      throw new NotFoundException("Document not found");
    }
    const profile = await this.prisma.tutorProfile.findUnique({
      where: { id: doc.tutorProfileId },
    });
    if (!profile || profile.userId !== user.id) {
      throw new ForbiddenException("You cannot delete this document");
    }
    await this.prisma.document.delete({ where: { id: documentId } });
  }

  /** Re-check authorization, then mint a short-lived presigned download URL. */
  async getDownloadUrl(user: AuthenticatedUser, documentId: string): Promise<string> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) {
      throw new NotFoundException("Document not found");
    }

    if (doc.caseId) {
      await this.caseAccess.getViewableCase(user, doc.caseId);
    } else if (doc.tutorProfileId) {
      await this.assertCanViewProfile(user, doc.tutorProfileId);
    } else {
      throw new NotFoundException("Document not found");
    }

    return this.storage.presignedGetUrl(doc.storedKey, 60);
  }

  /** Parents may view any tutor profile; tutors only their own (D9). */
  private async assertCanViewProfile(user: AuthenticatedUser, profileId: string): Promise<void> {
    const profile = await this.prisma.tutorProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw new NotFoundException("Profile not found");
    }
    if (user.role === Role.TUTOR && profile.userId !== user.id) {
      throw new NotFoundException("Profile not found");
    }
  }
}
