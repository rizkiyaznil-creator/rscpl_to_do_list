import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getKsAccess, parseKsInput, dbData, toDate, todayKey, ksUnauth, ksBad } from "@/lib/kerjasamaServer";
import { dupKeys } from "@/lib/kerjasama";

export const maxDuration = 60;

// POST /api/kerjasama/impor  body: { rows: [{ data, mitra, jenisAsal? }] }
// Impor daftar kerjasama dari Excel (dibaca & dipetakan di browser, lihat lib/ksImport.js).
// Hanya Admin/Manajer/Koordinator; hasil langsung FINAL (sumber "IMPOR"), field wajib
// yang kosong ditandai "perlu dilengkapi". Baris yang nomor dokumen + mitranya sudah ada dilewati.
export async function POST(request) {
  const session = await getSession();
  if (!session) return ksUnauth();
  const { access } = await getKsAccess(session);
  if (!access.verify) return ksBad("Impor hanya oleh Koordinator Kerja Sama, Manajer Kerja Sama dan Marketing, atau Admin.", 403);
  const body = await request.json().catch(() => null);
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 2000) : [];
  if (!rows.length) return ksBad("Tidak ada baris untuk diimpor.");

  const existing = await prisma.kerjasama.findMany({
    select: { nomorDokumen: true, mitra: { select: { nama: true }, orderBy: { urutan: "asc" }, take: 1 } },
  });
  const seen = new Set(existing.flatMap((k) => dupKeys(k.nomorDokumen, k.mitra[0]?.nama)));
  const today = toDate(todayKey());
  const now = new Date();
  let created = 0;
  const skipped = [];
  for (let i = 0; i < rows.length; i++) {
    const parsed = parseKsInput(rows[i], { lengkap: false });
    if (parsed.error) {
      skipped.push({ i, alasan: parsed.error });
      continue;
    }
    const tokens = dupKeys(parsed.data.nomorDokumen, parsed.mitra[0]?.nama);
    if (tokens.some((t) => seen.has(t))) {
      skipped.push({ i, alasan: "nomor dokumen sudah ada" });
      continue;
    }
    tokens.forEach((t) => seen.add(t));
    await prisma.kerjasama.create({
      data: {
        ...dbData(parsed.data),
        wajibEvalSejak: today,
        status: "FINAL",
        sumber: "IMPOR",
        jenisAsal: typeof rows[i].jenisAsal === "string" ? rows[i].jenisAsal.slice(0, 100) : null,
        createdById: session.id,
        verifiedById: session.id,
        verifiedAt: now,
        mitra: { create: parsed.mitra },
      },
    });
    created++;
  }
  return Response.json({ ok: true, created, skipped });
}
