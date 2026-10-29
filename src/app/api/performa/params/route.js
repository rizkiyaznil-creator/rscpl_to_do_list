import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { PARAM_FIELDS } from "@/lib/perfServer";
import { readParamBody } from "@/lib/perfParamInput";

// GET /api/performa/params -> semua parameter (termasuk nonaktif) + jumlah data.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const params = await prisma.perfParam.findMany({
    orderBy: [{ group: "asc" }, { order: "asc" }, { id: "asc" }],
    select: { ...PARAM_FIELDS, _count: { select: { values: true } } },
  });
  return Response.json({ params });
}

// POST /api/performa/params -> tambah parameter (khusus ADMIN).
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
  const { data, error } = readParamBody(body);
  if (error) return Response.json({ error }, { status: 400 });

  // Kode: dari isian atau dibuat dari nama; huruf kecil, angka, garis bawah.
  const base = ((body.code || data.name) + "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 30) || "param";
  let code = base;
  for (let i = 2; await prisma.perfParam.findUnique({ where: { code } }); i++) code = `${base}_${i}`;

  const last = await prisma.perfParam.findFirst({ where: { group: data.group }, orderBy: { order: "desc" } });
  const param = await prisma.perfParam.create({
    data: { ...data, code, order: (last?.order ?? 0) + 1 },
    select: PARAM_FIELDS,
  });
  return Response.json({ param }, { status: 201 });
}
