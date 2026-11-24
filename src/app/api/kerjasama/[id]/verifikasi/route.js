import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getKsAccess, dbData, notifyUser, KS_INCLUDE, serializeKs, ksDenied, ksUnauth, ksBad } from "@/lib/kerjasamaServer";
import { mitraNames } from "@/lib/kerjasama";

// POST /api/kerjasama/:id/verifikasi
// body: { target: "data" | "usulan", aksi: "setujui" | "kembalikan", catatan? }
// Hanya Admin, Manajer Kerja Sama dan Marketing, Koordinator Kerja Sama.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { access } = await getKsAccess(session);
  if (!access.verify) return ksBad("Verifikasi hanya oleh Koordinator Kerja Sama atau Manajer Kerja Sama dan Marketing.", 403);
  if (!access.view) return ksDenied();
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const setujui = body?.aksi === "setujui";
  const catatan = typeof body?.catatan === "string" ? body.catatan.trim().slice(0, 2000) : "";
  if (!setujui && body?.aksi !== "kembalikan") return ksBad("Aksi tidak valid.");
  if (!setujui && !catatan) return ksBad("Alasan pengembalian wajib diisi.");

  const ks = await prisma.kerjasama.findUnique({ where: { id: Number(id) }, include: { mitra: true } });
  if (!ks) return ksBad("Kerjasama tidak ditemukan.", 404);
  const nama = mitraNames(ks);
  const now = new Date();

  if (body?.target === "usulan") {
    if (!ks.usulan) return ksBad("Tidak ada usulan perubahan.");
    const proposer = ks.usulanById;
    let item;
    if (setujui) {
      const u = ks.usulan;
      item = await prisma.kerjasama.update({
        where: { id: ks.id },
        data: {
          ...dbData(u.data),
          usulan: null,
          usulanById: null,
          usulanAt: null,
          verifiedById: session.id,
          verifiedAt: now,
          mitra: { deleteMany: {}, create: u.mitra || [] },
        },
        include: KS_INCLUDE,
      });
      await notifyUser(proposer, session.id, "KS_VERIFIED", `Usulan perubahan kerjasama (${nama}) disetujui ${session.name}`, ks.id);
    } else {
      item = await prisma.kerjasama.update({
        where: { id: ks.id },
        data: { usulan: null, usulanById: null, usulanAt: null },
        include: KS_INCLUDE,
      });
      await notifyUser(proposer, session.id, "KS_RETURNED", `Usulan perubahan kerjasama (${nama}) dikembalikan ${session.name}: ${catatan}`, ks.id);
    }
    return Response.json({ ok: true, item: serializeKs(item) });
  }

  if (ks.status === "FINAL") return ksBad("Data ini sudah terverifikasi.");
  // Data DIKEMBALIKAN pun boleh langsung difinalkan verifikator setelah meninjau.
  const item = await prisma.kerjasama.update({
    where: { id: ks.id },
    data: setujui
      ? { status: "FINAL", catatanVerif: null, verifiedById: session.id, verifiedAt: now }
      : { status: "DIKEMBALIKAN", catatanVerif: catatan },
    include: KS_INCLUDE,
  });
  await notifyUser(
    ks.createdById,
    session.id,
    setujui ? "KS_VERIFIED" : "KS_RETURNED",
    setujui ? `Data kerjasama (${nama}) telah diverifikasi ${session.name}` : `Data kerjasama (${nama}) dikembalikan ${session.name}: ${catatan}`,
    ks.id,
  );
  return Response.json({ ok: true, item: serializeKs(item) });
}
