import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";

// POST /api/auth/forgot -> permintaan reset password (PUBLIK, tanpa login).
// Tidak mengubah apa pun; hanya MEMBERI TAHU admin agar admin yang mereset
// password (password lama tidak bisa dilihat karena disimpan sebagai hash).
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const username = (body?.username || "").trim().toLowerCase();
  if (!username) {
    return Response.json({ error: "Username wajib diisi." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { username } });

  // Bila user ada, beri tahu semua admin aktif. Pesan balasan selalu generik
  // agar tidak membocorkan username mana yang terdaftar.
  if (user) {
    const admins = await prisma.user.findMany({
      where: { role: ROLES.ADMIN, status: USER_STATUS.ACTIVE },
      select: { id: true },
    });
    await Promise.all(
      admins.map((a) =>
        notify({
          userId: a.id,
          type: "RESET_REQUEST",
          message: `${user.name} (@${username}) lupa password & meminta reset.`,
        }),
      ),
    );
  }

  return Response.json({
    ok: true,
    message:
      "Permintaan Anda telah dikirim ke admin. Silakan hubungi admin untuk mendapatkan password baru, lalu ganti sendiri di menu “Akun Saya” setelah masuk.",
  });
}
