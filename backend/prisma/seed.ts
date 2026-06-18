import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcrypt";

const prisma = new PrismaClient();

/**
 * Demo credentials (documented in README):
 *   parent@example.com / password123  (PARENT)
 *   tutor1@example.com / password123   (TUTOR)
 *   tutor2@example.com / password123   (TUTOR)
 */
const DEMO_PASSWORD = "password123";

const users: Array<{ email: string; role: Role }> = [
  { email: "parent@example.com", role: Role.PARENT },
  { email: "tutor1@example.com", role: Role.TUTOR },
  { email: "tutor2@example.com", role: Role.TUTOR },
];

async function main(): Promise<void> {
  const passwordHash = await hash(DEMO_PASSWORD, 10);
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { role: u.role, passwordHash },
      create: { email: u.email, role: u.role, passwordHash },
    });
    console.log(`seeded ${u.role} ${u.email}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
