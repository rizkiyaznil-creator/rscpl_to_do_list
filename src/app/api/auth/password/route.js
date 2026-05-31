import { prisma } from "@/lib/prisma";
import { getSession, verifyPassword, hashPassword } from "@/lib/auth";

// PATCH /api/auth/password -> user mengganti password sendiri.
// Wajib menyertakan password lama yang benar.
export async function PATCH(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const currentPassword = body?.currentPassword || "";
  const newPassword = body?.newPassword || "";

  if (!currentPassword || !newPassword) {
    return Response.json(
      { error: "Password lama dan password baru wajib diisi." },
      { status: 400 },
    );
  }
  if (newPassword.length < 6) {
    return Response.json(
      { error: "Password baru minimal 6 karakter." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) {
    return Response.json({ error: "Pengguna tidak ditemukan." }, { status: 404 });
  }

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) {
    return Response.json({ error: "Password lama salah." }, { status: 400 });
  }

  // Tolak bila password baru sama dengan yang lama.
  const same = await verifyPassword(newPassword, user.passwordHash);
  if (same) {
    return Response.json(
      { error: "Password baru harus berbeda dari password lama." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return Response.json({ ok: true });
}
