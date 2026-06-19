import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Role } from "@prisma/client";
import { compare, hash } from "bcrypt";
import { PrismaService } from "../prisma/prisma.service";
import type { TokenPair } from "./auth.types";
import type { MeResponseDto } from "./dto/auth-responses.dto";
import type { RegisterResponseDto } from "./dto/register.dto";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(
    email: string,
    password: string,
    role: Role,
    displayName?: string,
  ): Promise<RegisterResponseDto> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("An account with that email already exists");
    }
    const passwordHash = await hash(password, 10);
    const user = await this.prisma.user.create({
      data: { email, passwordHash, role },
      select: { id: true, email: true, role: true },
    });
    if (role === Role.TUTOR) {
      const derivedName = displayName ?? email.split("@")[0];
      await this.prisma.tutorProfile.create({
        data: {
          userId: user.id,
          displayName: derivedName,
          qualifications: [],
          experiences: [],
        },
      });
    }
    return user;
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always run a comparison shape; reject with a single generic message to
    // avoid leaking which of email/password was wrong.
    if (!user || !(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Invalid credentials");
    }
    return this.tokens.issuePair({ id: user.id, role: user.role });
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    return this.tokens.rotate(refreshToken);
  }

  async logout(jti: string): Promise<void> {
    await this.tokens.revokeByAccessJti(jti);
  }

  async me(userId: string): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true },
    });
    if (!user) {
      throw new UnauthorizedException("User no longer exists");
    }
    return user;
  }
}
