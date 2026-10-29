import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES, isValidPositionLevel } from "@/lib/constants";
import { isSelfOrDescendant } from "@/lib/positions";

async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    return { res: Response.json({ error: "Tidak terautentikasi." }, { status: 401 }) };
  }
  if (session.role !== ROLES.ADMIN) {
    return { res: Response.json({ error: "Khusus admin." }, { status: 403 }) };
  }
  return { session };
}

// PATCH /api/positions/:id -> ubah nama/level/bidang/atasan/aturan 1 orang.
export async function PATCH(request, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;

  const { id } = await params;
  const positionId = Number(id);
  if (!Number.isInteger(positionId)) {
    return Response.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { _count: { select: { users: true } } },
  });
  if (!position) {
    return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const data = {};
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return Response.json({ error: "Nama jabatan wajib diisi." }, { status: 400 });
    }
    data.name = name;
  }
  if (body.level !== undefined) {
    if (!isValidPositionLevel(body.level)) {
      return Response.json({ error: "Level jabatan tidak valid." }, { status: 400 });
    }
    data.level = body.level;
  }
  if (typeof body.bidang === "string") data.bidang = body.bidang.trim() || null;
  if (typeof body.single === "boolean") {
    if (body.single && position._count.users > 1) {
      return Response.json(
        { error: "Jabatan ini dipegang lebih dari 1 orang, tidak bisa dijadikan jabatan 1 orang." },
        { status: 400 },
      );
    }
    data.single = body.single;
  }
  if ("parentId" in body) {
    const parentId = body.parentId ? Number(body.parentId) : null;
    if (parentId !== null) {
      const parent = await prisma.position.findUnique({ where: { id: parentId } });
      if (!parent) {
        return Response.json({ error: "Atasan tidak ditemukan." }, { status: 400 });
      }
      if (await isSelfOrDescendant(positionId, parentId)) {
        return Response.json(
          { error: "Atasan tidak boleh jabatan itu sendiri atau bawahannya." },
          { status: 400 },
        );
      }
    }
    data.parentId = parentId;
  }

  const updated = await prisma.position.update({ where: { id: positionId }, data });
  return Response.json({ position: updated });
}

// DELETE /api/positions/:id -> hapus jabatan (hanya bila tanpa bawahan & pemegang).
export async function DELETE(request, { params }) {
  const { res } = await requireAdmin();
  if (res) return res;

  const { id } = await params;
  const positionId = Number(id);
  if (!Number.isInteger(positionId)) {
    return Response.json({ error: "ID tidak valid." }, { status: 400 });
  }
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { _count: { select: { users: true, children: true } } },
  });
  if (!position) {
    return Response.json({ error: "Jabatan tidak ditemukan." }, { status: 404 });
  }
  if (position._count.children > 0) {
    return Response.json(
      { error: "Jabatan ini masih punya bawahan. Pindahkan/hapus bawahannya dulu." },
      { status: 400 },
    );
  }
  if (position._count.users > 0) {
    return Response.json(
      { error: "Jabatan ini masih dipegang personel. Lepaskan dulu dari personelnya." },
      { status: 400 },
    );
  }

  await prisma.position.delete({ where: { id: positionId } });
  return Response.json({ ok: true });
}
