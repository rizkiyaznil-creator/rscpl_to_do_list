import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// GET /api/log-categories -> daftar kategori baku logbook.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const categories = await prisma.logCategory.findMany({
    orderBy: [{ order: "asc" }, { id: "asc" }],
  });
  return Response.json({ categories });
}

// POST /api/log-categories { name } -> tambah kategori baku (khusus ADMIN).
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
  if (!name) return Response.json({ error: "Nama kategori wajib diisi." }, { status: 400 });
  if (name.length > 60) {
    return Response.json({ error: "Nama kategori maksimal 60 karakter." }, { status: 400 });
  }
  if (name.toLowerCase().startsWith("lainnya")) {
    return Response.json(
      { error: '"Lainnya" sudah tersedia otomatis untuk kategori yang ditulis sendiri.' },
      { status: 400 },
    );
  }

  const exists = await prisma.logCategory.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (exists) return Response.json({ error: "Kategori sudah ada." }, { status: 409 });

  const last = await prisma.logCategory.findFirst({ orderBy: { order: "desc" } });
  const category = await prisma.logCategory.create({
    data: { name, order: (last?.order ?? 0) + 1 },
  });
  return Response.json({ category }, { status: 201 });
}
