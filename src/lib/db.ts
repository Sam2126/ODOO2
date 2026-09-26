import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

/**
 * Prisma 7 connects through a driver adapter rather than a datasource URL in
 * the schema. In development the client is cached on globalThis so Next.js
 * hot reloads do not open a new pool on every edit.
 */
const createPrismaClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
    log: env.isDevelopment ? ["warn", "error"] : ["error"],
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.isDevelopment) {
  globalForPrisma.prisma = prisma;
}
