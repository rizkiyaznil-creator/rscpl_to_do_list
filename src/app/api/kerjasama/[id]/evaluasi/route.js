import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getKsAccess,
  parseEvalInput,
  toDate,
  notifyVerifiers,
  KS_INCLUDE,
  serializeKs,
  ksDenied,
  ksUnauth,
  ksBad,
  todayKey,
} from "@/lib/kerjasamaServer";
import { evalSchedule, mitraNames, toYmd } from "@/lib/kerjasama";

// POST /api/kerjasama/:id/evaluasi  body: { ke, tanggal, hasil, rekomendasi, catatan, link }
// Input hasil evaluasi wajib ke-n. Admin/Manajer/Koordinator -> FINAL; Staf -> MENUNGGU.
// Evaluasi yang belum final dapat diubah lagi oleh penginputnya / verifikator.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { org, access } = await getKsAccess(session);
  if (!access.input) return ksDenied();
  const { id } = await params;
  const ks = await prisma.kerjasama.findUnique({ where: { id: Number(id) }, include: { mitra: true, evaluasi: true } });
  if (!ks) return ksBad("Kerjasama tidak ditemukan.", 404);
  if (ks.status !== "FINAL") return ksBad("Evaluasi hanya untuk kerjasama yang sudah terverifikasi.");
  if (!ks.evalBulan) return ksBad("Isi dulu periode evaluasi wajib kerjasama ini.");

  const body = await request.json().catch(() => null);
  const ke = Number(body?.ke);
  const jadwal = evalSchedule({ ...ks, mulai: toYmd(ks.mulai), berakhir: toYmd(ks.berakhir), wajibEvalSejak: toYmd(ks.wajibEvalSejak) }, todayKey()).find(
    (s) => s.ke === ke,
  );
  if (!jadwal) return ksBad("Jadwal evaluasi tidak valid.");
  const parsed = parseEvalInput(body);
  if (parsed.error) return ksBad(parsed.error);

  const existing = ks.evaluasi.find((e) => e.ke === ke);
  if (existing?.status === "FINAL" && !access.verify) return ksBad("Evaluasi ini sudah final; hanya verifikator yang dapat mengubahnya.", 403);
  if (existing && existing.status !== "FINAL" && !access.verify && existing.createdById !== session.id) {
    return ksBad("Evaluasi ini sedang diinput personel lain.", 403);
  }

  const final = access.verify;
  const now = new Date();
  const data = {
    jatuhTempo: toDate(jadwal.due),
    tanggal: toDate(parsed.tanggal),
    hasil: parsed.hasil,
    rekomendasi: parsed.rekomendasi,
    catatan: parsed.catatan,
    link: parsed.link,
    status: final ? "FINAL" : "MENUNGGU",
    catatanVerif: null,
    ...(final ? { verifiedById: session.id, verifiedAt: now } : { verifiedById: null, verifiedAt: null }),
  };
  await prisma.kerjasamaEvaluasi.upsert({
    where: { kerjasamaId_ke: { kerjasamaId: ks.id, ke } },
    update: data,
    create: { ...data, kerjasamaId: ks.id, ke, createdById: session.id },
  });
  if (!final) {
    await notifyVerifiers(org, session.id, `${session.name} menginput hasil evaluasi ke-${ke} kerjasama (${mitraNames(ks)}) — menunggu verifikasi`, ks.id);
  }
  const item = await prisma.kerjasama.findUnique({ where: { id: ks.id }, include: KS_INCLUDE });
  return Response.json({ ok: true, item: serializeKs(item) });
}
