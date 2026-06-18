import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// Database-backed e2e run against a real Postgres (the compose `db_test`
// service). Point them at it with E2E_DATABASE_URL; the default matches the
// documented compose test port. The health smoke stubs Prisma and ignores this.
const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ?? "postgresql://tuition:tuition@localhost:5433/tuition_test";

export default defineConfig({
  test: {
    globals: true,
    root: "./",
    include: ["test/**/*.e2e.spec.ts"],
    globalSetup: ["./test/global-setup.e2e.ts"],
    // bcrypt + app bootstrap per suite are not instant.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // Suites share one Postgres and truncate between files, so run serially.
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      DATABASE_DIRECT_URL: TEST_DATABASE_URL,
      JWT_SECRET: "test-secret-not-for-production",
      ACCESS_TOKEN_TTL: "900",
    },
  },
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          decoratorMetadata: true,
        },
      },
    }),
  ],
});
