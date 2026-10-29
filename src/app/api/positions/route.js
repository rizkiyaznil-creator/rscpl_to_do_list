import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES, isValidPositionLevel } from "@/lib/constants";

// Jabatan yang secara bawaan boleh diisi banyak orang.
const MULTI_LEVELS = ["ANGGOTA", "STAF"];

// GET /api/positions -> semua jabatan (urut sesuai SOTK) beserta pemegangnya.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const positions = await prisma.position.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
    include: {
      users: { select: { id: true, name: true }, orderBy: { name: "asc" } },
      _count: { select: { children: true } },
    },
  });

  return Response.json({ positions });
}

// POST /api/positions -> tambah jabatan (khusus ADMIN).
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

  const name = (body?.name || "").trim();
  const level = body?.level;
  if (!name) {
    return Response.json({ error: "Nama jabatan wajib diisi." }, { status: 400 });
  }
  if (!isValidPositionLevel(level)) {
    return Response.json({ error: "Level jabatan tidak valid." }, { status: 400 });
  }

  let parent = null;
  if (body?.parentId) {
    parent = await prisma.position.findUnique({ where: { id: Number(body.parentId) } });
    if (!parent) {
      return Response.json({ error: "Atasan tidak ditemukan." }, { status: 400 });
    }
  }

  // Bidang kosong -> ikuti bidang atasan.
  const bidang = (body?.bidang || "").trim() || parent?.bidang || null;
  const single =
    typeof body?.single === "boolean" ? body.single : !MULTI_LEVELS.includes(level);

  // Letakkan tepat setelah jabatan terakhir (urutan tampil).
  const last = await prisma.position.findFirst({ orderBy: { order: "desc" } });

  const position = await prisma.position.create({
    data: {
      name,
      level,
      bidang,
      single,
      parentId: parent?.id ?? null,
      order: (last?.order ?? 0) + 1,
    },
  });

  return Response.json({ position }, { status: 201 });
}
