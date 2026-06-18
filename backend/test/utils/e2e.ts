import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import { type Role } from "@prisma/client";
import { hash } from "bcrypt";
import { AppModule } from "../../src/app.module";
import { AllExceptionsFilter } from "../../src/common/filters/all-exceptions.filter";
import { PrismaService } from "../../src/prisma/prisma.service";
import { StorageService } from "../../src/storage/storage.service";

/** Records what was stored so download tests stay hermetic (no live MinIO). */
export class FakeStorage {
  readonly objects = new Map<string, Buffer>();
  async put(key: string, body: Buffer): Promise<void> {
    this.objects.set(key, body);
  }
  async presignedGetUrl(key: string): Promise<string> {
    return `https://signed.example/${key}?sig=test`;
  }
}

export interface E2EContext {
  app: INestApplication;
  prisma: PrismaService;
  jwt: JwtService;
  storage: FakeStorage;
}

/** Boot the real AppModule with throttling disabled and storage faked. */
export async function createE2EApp(): Promise<E2EContext> {
  const storage = new FakeStorage();
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    // The rate limiter is bound globally via APP_GUARD (useClass), so there is
    // no standalone guard provider to override. Replace its storage with a
    // no-op that never reports a breach, disabling throttling for the suite.
    .overrideProvider(ThrottlerStorage)
    .useValue({
      increment: async () => ({
        totalHits: 1,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      }),
    })
    .overrideProvider(StorageService)
    .useValue(storage)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    jwt: app.get(JwtService),
    storage,
  };
}

/** Delete all rows in FK-safe order so each suite starts clean. */
export async function resetDb(prisma: PrismaService): Promise<void> {
  await prisma.document.deleteMany();
  await prisma.caseInvite.deleteMany();
  await prisma.oauthRefreshToken.deleteMany();
  await prisma.oauthAccessToken.deleteMany();
  await prisma.tutorProfile.deleteMany();
  await prisma.case.deleteMany();
  await prisma.user.deleteMany();
}

export interface SeededUsers {
  parentId: string;
  tutor1Id: string;
  tutor2Id: string;
}

const PASSWORD = "password123";

/** Seed the three demo users and return their ids. */
export async function seedUsers(prisma: PrismaService): Promise<SeededUsers> {
  const passwordHash = await hash(PASSWORD, 10);
  const mk = (email: string, role: Role) =>
    prisma.user.create({ data: { email, role, passwordHash } });
  const [parent, tutor1, tutor2] = await Promise.all([
    mk("parent@example.com", "PARENT"),
    mk("tutor1@example.com", "TUTOR"),
    mk("tutor2@example.com", "TUTOR"),
  ]);
  return { parentId: parent.id, tutor1Id: tutor1.id, tutor2Id: tutor2.id };
}

export { PASSWORD };
