import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getKsAccess,
  parseKsInput,
  dbData,
  notifyVerifiers,
  KS_INCLUDE,
  serializeKs,
  ksDenied,
  ksUnauth,
  ksBad,
} from "@/lib/kerjasamaServer";
import { mitraNames } from "@/lib/kerjasama";

async function loadOne(id) {
  return prisma.kerjasama.findUnique({ where: { id: Number(id) }, include: { mitra: { orderBy: { urutan: "asc" } } } });
}

// PUT /api/kerjasama/:id  body: { data, mitra }
//  - Admin/Manajer/Koordinator: langsung mengubah data.
//  - Staf: data belum final miliknya -> diubah & dikirim ulang (MENUNGGU);
//          data FINAL -> disimpan sebagai USULAN perubahan sampai diverifikasi.
export async function PUT(request, { params }) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { org, access } = await getKsAccess(session);
  if (!access.input) return ksDenied();
  const { id } = await params;
  const ks = await loadOne(id);
  if (!ks) return ksBad("Kerjasama tidak ditemukan.", 404);

  const body = await request.json().catch(() => null);
  // Data impor boleh disimpan bertahap oleh verifikator (field wajib dilengkapi menyusul).
  const parsed = parseKsInput(body, { lengkap: !(access.verify && ks.sumber === "IMPOR") });
  if (parsed.error) return ksBad(parsed.error);

  if (access.verify) {
    const item = await prisma.kerjasama.update({
      where: { id: ks.id },
      data: { ...dbData(parsed.data), mitra: { deleteMany: {}, create: parsed.mitra } },
      include: KS_INCLUDE,
    });
    return Response.json({ ok: true, item: serializeKs(item) });
  }

  if (ks.status !== "FINAL") {
    if (ks.createdById !== session.id) return ksBad("Hanya penginput yang dapat mengubah data yang belum diverifikasi.", 403);
    const item = await prisma.kerjasama.update({
      where: { id: ks.id },
      data: { ...dbData(parsed.data), status: "MENUNGGU", catatanVerif: null, mitra: { deleteMany: {}, create: parsed.mitra } },
      include: KS_INCLUDE,
    });
    await notifyVerifiers(org, session.id, `${session.name} memperbarui data kerjasama (${mitraNames(item)}) — menunggu verifikasi`, item.id);
    return Response.json({ ok: true, item: serializeKs(item) });
  }

  // Data FINAL: simpan sebagai usulan perubahan.
  const item = await prisma.kerjasama.update({
    where: { id: ks.id },
    data: { usulan: { data: parsed.data, mitra: parsed.mitra }, usulanById: session.id, usulanAt: new Date() },
    include: KS_INCLUDE,
  });
  await notifyVerifiers(org, session.id, `${session.name} mengusulkan perubahan data kerjasama (${mitraNames(ks)}) — menunggu verifikasi`, ks.id);
  return Response.json({ ok: true, item: serializeKs(item), usulan: true });
}

// DELETE /api/kerjasama/:id — verifikator: semua; Staf: data miliknya yang belum final.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { access } = await getKsAccess(session);
  if (!access.input) return ksDenied();
  const { id } = await params;
  const ks = await loadOne(id);
  if (!ks) return ksBad("Kerjasama tidak ditemukan.", 404);
  if (!access.verify && (ks.status === "FINAL" || ks.createdById !== session.id)) {
    return ksBad("Data kerjasama final hanya dapat dihapus oleh Koordinator/Manajer Kerja Sama.", 403);
  }
  await prisma.kerjasama.delete({ where: { id: ks.id } });
  return Response.json({ ok: true });
}
