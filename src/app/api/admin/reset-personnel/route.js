import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// POST /api/admin/reset-personnel  { confirm: "HAPUS" }
// Menghapus SEMUA akun selain admin beserta seluruh tugas, notifikasi, dan
// riwayat aktivitas — untuk memulai ulang data sesuai SOTK baru.
// Daftar jabatan TIDAK dihapus. Tindakan ini permanen.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (session.role !== ROLES.ADMIN) {
    return Response.json({ error: "Khusus admin." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  if (body?.confirm !== "HAPUS") {
    return Response.json(
      { error: 'Ketik "HAPUS" untuk mengonfirmasi.' },
      { status: 400 },
    );
  }

  // Tugas dihapus dulu (checklist & komentar ikut terhapus via cascade).
  const [notifications, activities, tasks, users] = await prisma.$transaction([
    prisma.notification.deleteMany({}),
    prisma.activity.deleteMany({}),
    prisma.task.deleteMany({}),
    prisma.user.deleteMany({ where: { role: { not: ROLES.ADMIN } } }),
  ]);

  return Response.json({
    ok: true,
    deleted: {
      users: users.count,
      tasks: tasks.count,
      notifications: notifications.count,
      activities: activities.count,
    },
  });
}
