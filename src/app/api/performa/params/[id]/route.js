import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { PARAM_FIELDS } from "@/lib/perfServer";
import { readParamBody } from "@/lib/perfParamInput";

async function loadForAdmin(params) {
  const session = await getSession();
  if (!session) return { res: Response.json({ error: "Tidak terautentikasi." }, { status: 401 }) };
  if (session.role !== ROLES.ADMIN) return { res: Response.json({ error: "Khusus admin." }, { status: 403 }) };
  const { id } = await params;
  const pid = Number(id);
  const param = Number.isInteger(pid)
    ? await prisma.perfParam.findUnique({ where: { id: pid }, include: { _count: { select: { values: true } } } })
    : null;
  if (!param) return { res: Response.json({ error: "Parameter tidak ditemukan." }, { status: 404 }) };
  return { param };
}

// PATCH /api/performa/params/:id -> ubah parameter.
// Jenis & frekuensi tidak bisa diubah pada parameter inti atau yang sudah berisi data.
export async function PATCH(request, { params }) {
  const { param, res } = await loadForAdmin(params);
  if (res) return res;
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const { data, error } = readParamBody(body, { partial: true });
  if (error) return Response.json({ error }, { status: 400 });

  const changesShape =
    (data.kind && data.kind !== param.kind) || (data.freq && data.freq !== param.freq);
  if (changesShape && (param.builtin || param._count.values > 0)) {
    return Response.json(
      { error: "Jenis/frekuensi tidak bisa diubah: parameter inti atau sudah berisi data." },
      { status: 400 },
    );
  }
  if (param.builtin && data.active === false) {
    return Response.json(
      { error: "Parameter inti sensus rawat inap dipakai rumus BOR/ALOS dan tidak bisa dinonaktifkan." },
      { status: 400 },
    );
  }
  const updated = await prisma.perfParam.update({ where: { id: param.id }, data, select: PARAM_FIELDS });
  return Response.json({ param: updated });
}

// DELETE /api/performa/params/:id -> hapus parameter (hanya bila bukan inti & belum berisi data).
export async function DELETE(request, { params }) {
  const { param, res } = await loadForAdmin(params);
  if (res) return res;
  if (param.builtin) {
    return Response.json({ error: "Parameter inti tidak bisa dihapus." }, { status: 400 });
  }
  if (param._count.values > 0) {
    return Response.json(
      { error: "Parameter sudah berisi data. Nonaktifkan saja agar riwayat tetap tersimpan." },
      { status: 400 },
    );
  }
  await prisma.perfParam.delete({ where: { id: param.id } });
  return Response.json({ ok: true });
}
