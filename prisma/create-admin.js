// Membuat / memastikan SATU akun ADMIN ada — untuk inisialisasi database
// produksi tanpa data demo. Jalankan: node prisma/create-admin.js  (atau
// `npm run db:admin`) dengan DATABASE_URL menunjuk ke database produksi.
//
// Username/nama/password diambil dari env (opsional), default "admin"/"admin123":
//   ADMIN_USERNAME=admin  ADMIN_PASSWORD=rahasia  ADMIN_NAME="Administrator"  npm run db:admin
//
// GANTI password default segera setelah login pertama.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const name = process.env.ADMIN_NAME || "Administrator";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { username },
    // Jika sudah ada: pastikan ADMIN & ACTIVE, tapi JANGAN timpa password.
    update: { role: "ADMIN", status: "ACTIVE" },
    create: {
      username,
      name,
      role: "ADMIN",
      status: "ACTIVE",
      department: "Manajemen",
      passwordHash,
    },
  });

  console.log(
    `Admin siap: username="${admin.username}" (role=${admin.role}, status=${admin.status}).`,
  );
  if (!process.env.ADMIN_PASSWORD) {
    console.log('Password default: "admin123" — SEGERA ganti setelah login pertama.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
