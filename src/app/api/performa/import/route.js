import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { canInputPerforma } from "@/lib/constants";
import { keyToDate } from "@/lib/logdate";
import { loadParams, validatePeriod, savePeriod, isFuturePeriod } from "@/lib/perfServer";
import { parseWorkbook } from "@/lib/perfExcel";

const MAX_BYTES = 4 * 1024 * 1024;

// POST /api/performa/import?commit=1   (multipart, field "file" berisi .xlsx)
// Tanpa commit: hanya memeriksa & meringkas. Dengan commit=1: menyimpan bila tanpa error.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (!canInputPerforma(session.role)) {
    return Response.json({ error: "Hanya Admin/Subadmin yang dapat mengimpor data." }, { status: 403 });
  }

  let file;
  try {
    file = (await request.formData()).get("file");
  } catch {
    return Response.json({ error: "Unggahan tidak valid." }, { status: 400 });
  }
  if (!file || typeof file.arrayBuffer !== "function") {
    return Response.json({ error: "Pilih file Excel (.xlsx) terlebih dahulu." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "Ukuran file maksimal 4 MB." }, { status: 400 });
  }

  const params = await loadParams();
  const { periods, errors } = await parseWorkbook(await file.arrayBuffer(), params);

  // Validasi isian tiap periode dengan aturan yang sama seperti form input.
  const valid = [];
  for (const p of periods) {
    if (isFuturePeriod(p.type, p.start)) {
      errors.push(`Sheet ${p.sheet} baris ${p.row}: periode ${p.start} belum berjalan.`);
      continue;
    }
    const v = validatePeriod(params, p.type, p.input);
    v.errors.forEach((e) => errors.push(`Sheet ${p.sheet} baris ${p.row}: ${e}`));
    if (!v.errors.length) valid.push({ ...p, rows: v.rows.filter((r) => !r.clear) });
  }

  // Hitung nilai yang akan menimpa data lama.
  const existing = await prisma.perfValue.findMany({
    where: {
      OR: valid.map((p) => ({ periodType: p.type, periodStart: keyToDate(p.start) })),
    },
    select: { paramId: true, periodType: true, periodStart: true },
  });
  const existKey = new Set(existing.map((e) => `${e.paramId}|${e.periodType}|${e.periodStart.toISOString().slice(0, 10)}`));
  let cells = 0;
  let overwrite = 0;
  for (const p of valid) {
    for (const r of p.rows) {
      cells++;
      if (existKey.has(`${r.param.id}|${p.type}|${p.start}`)) overwrite++;
    }
  }
  const starts = (t) => valid.filter((p) => p.type === t).map((p) => p.start).sort();
  const summary = {
    weeks: starts("WEEK").length,
    months: starts("MONTH").length,
    weekRange: starts("WEEK").length ? [starts("WEEK")[0], starts("WEEK").at(-1)] : null,
    monthRange: starts("MONTH").length ? [starts("MONTH")[0].slice(0, 7), starts("MONTH").at(-1).slice(0, 7)] : null,
    cells,
    overwrite,
  };

  const commit = new URL(request.url).searchParams.get("commit") === "1";
  if (!commit) return Response.json({ ok: errors.length === 0, summary, errors: errors.slice(0, 50), errorCount: errors.length });

  if (errors.length) {
    return Response.json({ error: "Masih ada kesalahan di file. Perbaiki lalu periksa ulang.", errors: errors.slice(0, 50), errorCount: errors.length }, { status: 400 });
  }
  if (!cells) return Response.json({ error: "Tidak ada data untuk diimpor." }, { status: 400 });
  for (const p of valid) {
    await savePeriod(p.type, p.start, p.rows, session.id, { clearEmpty: false });
  }
  return Response.json({ ok: true, imported: summary });
}
