import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";

// POST /api/auth/register -> pendaftaran mandiri (PUBLIK, tanpa login).
// Akun dibuat dengan status PENDING dan TIDAK bisa login sampai diverifikasi
// admin. Tidak membuat sesi otomatis.
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const username = (body?.username || "").trim().toLowerCase();
  const name = (body?.name || "").trim();
  const password = body?.password || "";
  const department = (body?.department || "").trim() || null;

  if (!username || !name || !password) {
    return Response.json(
      { error: "Nama, username, dan password wajib diisi." },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9._-]{3,}$/.test(username)) {
    return Response.json(
      {
        error:
          "Username minimal 3 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau strip.",
      },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return Response.json({ error: "Username sudah dipakai." }, { status: 409 });
  }

  await prisma.user.create({
    data: {
      username,
      name,
      department,
      passwordHash: await hashPassword(password),
      role: ROLES.STAFF,
      status: USER_STATUS.PENDING,
    },
  });

  // Beri tahu semua admin aktif bahwa ada pendaftar baru yang menunggu verifikasi.
  const admins = await prisma.user.findMany({
    where: { role: ROLES.ADMIN, status: USER_STATUS.ACTIVE },
    select: { id: true },
  });
  await Promise.all(
    admins.map((a) =>
      notify({
        userId: a.id,
        type: "REGISTER",
        message: `Pendaftar baru: ${name} (@${username}) menunggu verifikasi`,
      }),
    ),
  );

  return Response.json({
    ok: true,
    message:
      "Pendaftaran berhasil! Akun Anda menunggu verifikasi admin. Anda baru bisa masuk setelah disetujui.",
  });
}
