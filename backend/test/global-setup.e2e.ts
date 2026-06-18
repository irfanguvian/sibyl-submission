import { execSync } from "node:child_process";

// Apply the committed migrations to the test database once, before any e2e
// suite boots. Mirrors the URL resolution in vitest.e2e.config.ts so a single
// E2E_DATABASE_URL override drives both.
const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://tuition:tuition@localhost:5433/tuition_test";

export default function setup(): void {
  execSync("pnpm exec prisma migrate deploy", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_DIRECT_URL: TEST_DATABASE_URL,
    },
  });
}
