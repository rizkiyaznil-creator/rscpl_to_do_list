import { PrismaClient } from "@prisma/client";

// Gunakan satu instance PrismaClient yang di-cache di global agar tidak
// membuat koneksi baru setiap hot-reload saat pengembangan.
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
