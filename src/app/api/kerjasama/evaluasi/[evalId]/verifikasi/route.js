import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getKsAccess, notifyUser, KS_INCLUDE, serializeKs, ksUnauth, ksBad } from "@/lib/kerjasamaServer";
import { mitraNames } from "@/lib/kerjasama";

// POST /api/kerjasama/evaluasi/:evalId/verifikasi  body: { aksi: "setujui" | "kembalikan", catatan? }
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { access } = await getKsAccess(session);
  if (!access.verify) return ksBad("Verifikasi hanya oleh Koordinator Kerja Sama atau Manajer Kerja Sama dan Marketing.", 403);
  const { evalId } = await params;
  const body = await request.json().catch(() => ({}));
  const setujui = body?.aksi === "setujui";
  const catatan = typeof body?.catatan === "string" ? body.catatan.trim().slice(0, 2000) : "";
  if (!setujui && body?.aksi !== "kembalikan") return ksBad("Aksi tidak valid.");
  if (!setujui && !catatan) return ksBad("Alasan pengembalian wajib diisi.");

  const ev = await prisma.kerjasamaEvaluasi.findUnique({
    where: { id: Number(evalId) },
    include: { kerjasama: { include: { mitra: true } } },
  });
  if (!ev) return ksBad("Evaluasi tidak ditemukan.", 404);
  if (ev.status === "FINAL") return ksBad("Evaluasi ini sudah terverifikasi.");

  await prisma.kerjasamaEvaluasi.update({
    where: { id: ev.id },
    data: setujui
      ? { status: "FINAL", catatanVerif: null, verifiedById: session.id, verifiedAt: new Date() }
      : { status: "DIKEMBALIKAN", catatanVerif: catatan },
  });
  const nama = mitraNames(ev.kerjasama);
  await notifyUser(
    ev.createdById,
    session.id,
    setujui ? "KS_VERIFIED" : "KS_RETURNED",
    setujui
      ? `Hasil evaluasi ke-${ev.ke} kerjasama (${nama}) diverifikasi ${session.name}`
      : `Hasil evaluasi ke-${ev.ke} kerjasama (${nama}) dikembalikan ${session.name}: ${catatan}`,
    ev.kerjasamaId,
  );
  const item = await prisma.kerjasama.findUnique({ where: { id: ev.kerjasamaId }, include: KS_INCLUDE });
  return Response.json({ ok: true, item: serializeKs(item) });
}
