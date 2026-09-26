import path from "node:path";

import { defineConfig, env } from "prisma/config";

// Prisma 7 no longer reads .env on its own, and the CLI runs outside Next.js
// (which does load it). Pull it in here so `prisma migrate` and `prisma db seed`
// see DATABASE_URL. Missing file is fine: CI supplies real environment variables.
try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // no .env on disk — fall through to the ambient environment
}

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx --env-file=.env --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
