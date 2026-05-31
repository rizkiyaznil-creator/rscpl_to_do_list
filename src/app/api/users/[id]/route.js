import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { ROLES, isValidRole } from "@/lib/constants";

const publicSelect = {
  id: true,
  username: true,
  name: true,
  role: true,
  department: true,
  createdAt: true,
  _count: { select: { ownedTasks: true } },
};

// PATCH /api/users/:id -> ubah data/role/reset password (khusus ADMIN).
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (session.role !== ROLES.ADMIN) {
    return Response.json({ error: "Khusus admin." }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return Response.json({ error: "Personel tidak ditemukan." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const data = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.department === "string") data.department = body.department.trim() || null;
  if (isValidRole(body.role)) data.role = body.role;
  if (body.password) {
    if (String(body.password).length < 6) {
      return Response.json({ error: "Password minimal 6 karakter." }, { status: 400 });
    }
    data.passwordHash = await hashPassword(String(body.password));
  }

  // Cegah admin terakhir menurunkan dirinya sendiri menjadi STAFF.
  if (data.role === ROLES.STAFF && target.role === ROLES.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN } });
    if (adminCount <= 1) {
      return Response.json(
        { error: "Tidak bisa menurunkan admin terakhir." },
        { status: 400 },
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: publicSelect,
  });

  return Response.json({ user });
}

// DELETE /api/users/:id -> hapus akun personel (khusus ADMIN, tidak bisa diri sendiri).
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (session.role !== ROLES.ADMIN) {
    return Response.json({ error: "Khusus admin." }, { status: 403 });
  }

  const { id } = await params;
  const userId = Number(id);

  if (userId === session.id) {
    return Response.json(
      { error: "Anda tidak dapat menghapus akun sendiri." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    return Response.json({ error: "Personel tidak ditemukan." }, { status: 404 });
  }

  // Jangan sampai menghapus admin terakhir.
  if (target.role === ROLES.ADMIN) {
    const adminCount = await prisma.user.count({ where: { role: ROLES.ADMIN } });
    if (adminCount <= 1) {
      return Response.json(
        { error: "Tidak bisa menghapus admin terakhir." },
        { status: 400 },
      );
    }
  }

  // Tugas milik user akan ikut terhapus (onDelete: Cascade pada relasi owner).
  await prisma.user.delete({ where: { id: userId } });
  return Response.json({ ok: true });
}
