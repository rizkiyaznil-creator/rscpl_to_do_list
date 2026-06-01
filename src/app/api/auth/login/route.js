import { prisma } from "@/lib/prisma";
import { verifyPassword, createSession } from "@/lib/auth";
import { USER_STATUS } from "@/lib/constants";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const username = (body?.username || "").trim();
  const password = body?.password || "";

  if (!username || !password) {
    return Response.json(
      { error: "Username dan password wajib diisi." },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  const ok = user && (await verifyPassword(password, user.passwordHash));

  if (!ok) {
    // Pesan generik agar tidak membocorkan username mana yang valid.
    return Response.json(
      { error: "Username atau password salah." },
      { status: 401 },
    );
  }

  // Kredensial benar, tetapi akun harus sudah diverifikasi admin untuk masuk.
  if (user.status !== USER_STATUS.ACTIVE) {
    return Response.json(
      {
        error:
          "Akun Anda belum diverifikasi admin. Mohon tunggu persetujuan sebelum dapat masuk.",
      },
      { status: 403 },
    );
  }

  await createSession(user);

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      department: user.department,
    },
  });
}
