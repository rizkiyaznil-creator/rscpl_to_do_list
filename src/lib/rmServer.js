import { prisma } from "@/lib/prisma";

// Penyimpanan Laporan Rekam Medis (hasil baca file Excel RM di browser).
// Data dibersihkan dulu (hanya field yang dikenal, angka/teks dibatasi) lalu:
//  - disimpan utuh per bulan di RmReport (bagian "H. Rekam Medis"),
//  - mengisi parameter Performa RS otomatis (auto = "RM") per bulan.

const isYm = (s) => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const n = (v) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e7 ? v : null);
const t = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : null);
const list = (xs, max = 80, extra = false) =>
  (Array.isArray(xs) ? xs : [])
    .slice(0, max)
    .map((x) => ({ nama: t(x?.nama), jumlah: n(x?.jumlah) ?? 0, ...(extra && { icd: t(x?.icd, 12) }) }))
    .filter((x) => x.nama);
const PENJAMIN = ["bpjs", "bpjsTk", "iom", "jasaRaharja", "umum", "asuransiLain"];
const penjamin = (p) => (p && typeof p === "object" ? Object.fromEntries(PENJAMIN.map((k) => [k, n(p[k]) ?? 0])) : null);

export function cleanReport(r) {
  if (!r || !isYm(r.bulan)) return null;
  const rj = r.rj && {
    total: n(r.rj.total),
    baru: n(r.rj.baru),
    lama: n(r.rj.lama),
    pmksPpds: n(r.rj.pmksPpds),
    baksos: n(r.rj.baksos),
    penjamin: penjamin(r.rj.penjamin),
    perPoli: list(r.rj.perPoli),
    penunjang: list(r.rj.penunjang, 30),
    top10: list(r.rj.top10, 10, true),
    ibp: {
      total: n(r.rj.ibp?.total),
      perJenis: list(r.rj.ibp?.perJenis, 10),
      perSub: list(r.rj.ibp?.perSub, 30),
    },
  };
  const igd = r.igd && {
    total: n(r.igd.total),
    penjamin: penjamin(r.igd.penjamin),
    perSpesialis: list(r.igd.perSpesialis, 50),
    caraDatang: list(r.igd.caraDatang, 15),
    caraKeluar: list(r.igd.caraKeluar, 15),
  };
  const ri = r.ri && {
    total: n(r.ri.total),
    penjamin: penjamin(r.ri.penjamin),
    perRuang: list(r.ri.perRuang, 40),
    perSpesialis: list(r.ri.perSpesialis, 50),
    ...Object.fromEntries(
      ["paps", "dirujuk", "meninggal", "doa", "bor", "los", "toi", "btoBulan", "ndr", "gdr", "podr", "nmr", "imr", "mmr"].map((k) => [k, n(r.ri[k])]),
    ),
    top10: list(r.ri.top10, 10, true),
  };
  if (!rj?.total && !igd?.total && !ri?.total) return null;
  const modified = r.modified && !Number.isNaN(Date.parse(r.modified)) ? new Date(r.modified) : null;
  return { bulan: r.bulan, file: t(r.file, 200), modified, data: { rj, igd, ri } };
}

const find = (xs, re) => (xs || []).find((x) => re.test(x.nama))?.jumlah ?? null;

// Nilai parameter otomatis dari satu laporan RM.
export function rmParamValues(d) {
  return {
    rajal: d.rj?.total ?? null,
    igd: d.igd?.total ?? null,
    ranap_masuk: d.ri?.total ?? null,
    lab: find(d.rj?.penunjang, /^lab/i),
    rad: find(d.rj?.penunjang, /radiolog/i),
  };
}

// Simpan laporan. Bulan yang sudah ada versi LEBIH BARU (tanggal simpan file)
// tidak ditimpa kecuali force. Mengembalikan ringkasan per bulan.
export async function saveRmReports(reports, userId, { force = false } = {}) {
  const params = await prisma.perfParam.findMany({ where: { auto: "RM" }, select: { id: true, code: true } });
  const result = [];
  for (const r of reports) {
    const month = new Date(`${r.bulan}-01T00:00:00.000Z`);
    const existing = await prisma.rmReport.findUnique({ where: { month }, select: { sourceModified: true, sourceFile: true } });
    if (!force && existing?.sourceModified && r.modified && existing.sourceModified > r.modified) {
      result.push({ bulan: r.bulan, status: "lewati", alasan: `versi tersimpan lebih baru (${existing.sourceFile})` });
      continue;
    }
    const row = { data: r.data, sourceFile: r.file, sourceModified: r.modified, uploadedById: userId };
    await prisma.rmReport.upsert({ where: { month }, update: row, create: { ...row, month } });
    const vals = rmParamValues(r.data);
    for (const p of params) {
      const v = vals[p.code];
      if (v == null) continue;
      await prisma.perfValue.upsert({
        where: { paramId_periodType_periodStart: { paramId: p.id, periodType: "MONTH", periodStart: month } },
        update: { value: v, num: null, den: null, updatedById: userId },
        create: { paramId: p.id, periodType: "MONTH", periodStart: month, value: v, updatedById: userId },
      });
    }
    result.push({ bulan: r.bulan, status: existing ? "diperbarui" : "baru" });
  }
  return result;
}

// Indikator rawat inap per bulan dari laporan RM (untuk Barber-Johnson di dashboard).
export async function loadRmMonthly(fromYm) {
  const rows = await prisma.rmReport.findMany({
    where: fromYm ? { month: { gte: new Date(`${fromYm}-01T00:00:00.000Z`) } } : {},
    select: { month: true, data: true },
  });
  const map = new Map();
  for (const r of rows) {
    const ri = r.data?.ri;
    if (!ri) continue;
    map.set(r.month.toISOString().slice(0, 7), {
      bor: ri.bor, alos: ri.los, toi: ri.toi, btoBulan: ri.btoBulan, ndr: ri.ndr, gdr: ri.gdr, n: ri.total || 0,
    });
  }
  return map;
}
