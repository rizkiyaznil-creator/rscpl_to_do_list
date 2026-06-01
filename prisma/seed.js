// Seed data awal: 1 admin + beberapa personel + contoh tugas.
// Jalankan dengan: npm run db:seed   (idempotent berkat upsert by username)

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function upsertUser({ username, name, role, department, password }) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.user.upsert({
    where: { username },
    update: { name, role, department, status: "ACTIVE" },
    create: { username, name, role, department, passwordHash, status: "ACTIVE" },
  });
}

async function main() {
  console.log("Menyiapkan data awal...");

  const admin = await upsertUser({
    username: "admin",
    name: "Administrator RS",
    role: "ADMIN",
    department: "Manajemen",
    password: "admin123",
  });

  const dokter = await upsertUser({
    username: "dr.andi",
    name: "dr. Andi Wijaya",
    role: "STAFF",
    department: "Poliklinik Umum",
    password: "password123",
  });

  const perawat = await upsertUser({
    username: "ns.budi",
    name: "Ns. Budi Santoso",
    role: "STAFF",
    department: "IGD",
    password: "password123",
  });

  const apoteker = await upsertUser({
    username: "siti.farmasi",
    name: "Siti Nurhaliza, S.Farm",
    role: "STAFF",
    department: "Farmasi",
    password: "password123",
  });

  // Contoh pendaftar mandiri yang masih MENUNGGU verifikasi admin, agar fitur
  // verifikasi langsung terlihat di panel admin. Hanya dibuat bila belum ada.
  const calon = await prisma.user.findUnique({ where: { username: "calon.staf" } });
  if (!calon) {
    await prisma.user.create({
      data: {
        username: "calon.staf",
        name: "Calon Personel (contoh pendaftar)",
        role: "STAFF",
        department: "Rawat Inap",
        status: "PENDING",
        passwordHash: await bcrypt.hash("password123", 10),
      },
    });
    console.log("Contoh pendaftar PENDING dibuat: calon.staf (tunggu verifikasi).");
  }

  // Buat contoh tugas hanya bila belum ada tugas sama sekali,
  // supaya seed bisa dijalankan ulang tanpa menumpuk data.
  const taskCount = await prisma.task.count();
  if (taskCount === 0) {
    const now = new Date();
    const inDays = (d) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

    await prisma.task.createMany({
      data: [
        {
          title: "Visite pasien rawat inap lantai 3",
          description: "Pemeriksaan rutin pagi untuk seluruh pasien lantai 3.",
          status: "IN_PROGRESS",
          progress: 40,
          priority: "HIGH",
          dueDate: inDays(0),
          ownerId: dokter.id,
          creatorId: dokter.id,
        },
        {
          title: "Lengkapi rekam medis pasien poli",
          description: "Input hasil pemeriksaan ke sistem rekam medis elektronik.",
          status: "TODO",
          progress: 0,
          priority: "MEDIUM",
          dueDate: inDays(1),
          ownerId: dokter.id,
          creatorId: admin.id,
        },
        {
          title: "Triase pasien IGD shift pagi",
          description: "Pemilahan prioritas pasien yang masuk IGD.",
          status: "IN_PROGRESS",
          progress: 65,
          priority: "HIGH",
          dueDate: inDays(0),
          ownerId: perawat.id,
          creatorId: perawat.id,
        },
        {
          title: "Cek kelengkapan obat troli emergensi",
          description: "Audit stok obat dan alkes troli emergensi IGD.",
          status: "DONE",
          progress: 100,
          priority: "MEDIUM",
          dueDate: inDays(-1),
          ownerId: perawat.id,
          creatorId: admin.id,
        },
        {
          title: "Stok opname obat gudang farmasi",
          description: "Hitung ulang stok fisik vs sistem untuk bulan ini.",
          status: "TODO",
          progress: 0,
          priority: "HIGH",
          dueDate: inDays(3),
          ownerId: apoteker.id,
          creatorId: admin.id,
        },
        {
          title: "Distribusi obat ke ruang rawat inap",
          description: "Pengantaran obat sesuai resep harian.",
          status: "IN_PROGRESS",
          progress: 20,
          priority: "LOW",
          dueDate: inDays(0),
          ownerId: apoteker.id,
          creatorId: apoteker.id,
        },
      ],
    });
    console.log("Contoh tugas dibuat.");
  } else {
    console.log(`Lewati pembuatan contoh tugas (sudah ada ${taskCount} tugas).`);
  }

  // Contoh notifikasi tersimpan (hanya bila belum ada).
  const notifCount = await prisma.notification.count();
  if (notifCount === 0) {
    const firstTask = await prisma.task.findFirst({ where: { ownerId: dokter.id } });
    await prisma.notification.createMany({
      data: [
        {
          userId: dokter.id,
          type: "ASSIGNED",
          message: `${admin.name} menugaskan "Lengkapi rekam medis pasien poli" kepada Anda`,
          taskId: firstTask?.id ?? null,
          read: false,
        },
        {
          userId: dokter.id,
          type: "COMMENT",
          message: `${perawat.name} berkomentar pada tugas Anda`,
          taskId: firstTask?.id ?? null,
          read: false,
        },
      ],
    });
    console.log("Contoh notifikasi dibuat.");
  }

  console.log("\nSelesai! Akun yang tersedia:");
  console.log("  Admin    -> username: admin         password: admin123");
  console.log("  Dokter   -> username: dr.andi       password: password123");
  console.log("  Perawat  -> username: ns.budi       password: password123");
  console.log("  Apoteker -> username: siti.farmasi  password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
