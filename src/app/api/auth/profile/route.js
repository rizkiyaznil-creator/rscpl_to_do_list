import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// PATCH /api/auth/profile -> user mengubah data profilnya sendiri (saat ini: email).
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

  const data = {};
  if ("email" in body) {
    const email = (body.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    data.email = email || null;
  }

  if (Object.keys(data).length === 0) {
    return Response.json({ error: "Tidak ada perubahan." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: session.id },
    data,
    select: { id: true, email: true },
  });

  return Response.json({ ok: true, user });
}
