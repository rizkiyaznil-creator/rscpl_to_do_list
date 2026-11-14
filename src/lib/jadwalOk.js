import { prisma } from "@/lib/prisma";
import { todayKey } from "@/lib/logdate";

// Integrasi aplikasi Jadwal Operasi (IBP) -> Performa RS.
// Menarik ringkasan laporan bulanan (GET /api/integrasi/laporan-bulanan) lalu:
//  - menyimpan JSON-nya di OkReport (dipakai bagian "Kamar Operasi" & rekap per KSM),
//  - mengisi parameter Performa RS otomatis (auto = "JADWAL_OK") per bulan.
// Konfigurasi (env): JADWAL_OK_URL (alamat aplikasi Jadwal Operasi) dan
// JADWAL_OK_TOKEN (sama dengan INTEGRASI_TOKEN di aplikasi tsb).

export function isConfigured() {
  return Boolean(process.env.JADWAL_OK_URL && process.env.JADWAL_OK_TOKEN);
}

const monthDate = (ym) => new Date(`${ym}-01T00:00:00.000Z`);

export function addMonth(ym, n) {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + m - 1 + n;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export function monthsBetween(from, to) {
  const out = [];
  for (let m = from; m <= to && out.length < 120; m = addMonth(m, 1)) out.push(m);
  return out;
}

async function fetchMonth(ym) {
  const base = process.env.JADWAL_OK_URL.replace(/\/$/, "");
  const res = await fetch(`${base}/api/integrasi/laporan-bulanan?bulan=${ym}`, {
    headers: { Authorization: `Bearer ${process.env.JADWAL_OK_TOKEN}` },
    cache: "no-store",
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* bukan JSON */
  }
  if (!res.ok) {
    const why =
      res.status === 401 ? "kunci integrasi tidak cocok" : res.status === 503 ? "integrasi belum diaktifkan di aplikasi Jadwal Operasi" : body?.error || `HTTP ${res.status}`;
    throw new Error(why);
  }
  return body;
}

// Nilai parameter otomatis dari satu laporan bulanan.
function paramValues(d) {
  const ratio = (x) => (x && x.penyebut > 0 ? { num: x.pembilang, den: x.penyebut } : null);
  const m = d.mutu || {};
  return {
    op_elektif: { value: d.jumlah?.dilaksanakan ?? null },
    ok_terjadwal: { value: d.jumlah?.terjadwal ?? null },
    inm_tunda: ratio(m.penundaanElektif),
    ok_batal: ratio(m.pembatalan),
    ok_ubah: ratio(m.perubahanJadwal),
    ok_mulai: ratio(m.mulaiOperasiPertama),
    ok_tunggu: m.waktuTunggu?.medianHari == null ? null : { value: m.waktuTunggu.medianHari },
    ok_util:
      m.utilisasi && m.utilisasi.menitTersedia > 0
        ? { num: m.utilisasi.menitTerpakai, den: m.utilisasi.menitTersedia }
        : null,
  };
}

// Tarik & simpan satu bulan. Mengembalikan ringkasan singkat.
export async function syncMonth(ym) {
  const d = await fetchMonth(ym);
  const month = monthDate(ym);
  await prisma.okReport.upsert({
    where: { month },
    update: { data: d, final: Boolean(d.final) },
    create: { month, data: d, final: Boolean(d.final) },
  });

  const params = await prisma.perfParam.findMany({ where: { auto: "JADWAL_OK" }, select: { id: true, code: true } });
  const vals = paramValues(d);
  for (const p of params) {
    if (!(p.code in vals)) continue;
    const v = vals[p.code];
    const key = { paramId_periodType_periodStart: { paramId: p.id, periodType: "MONTH", periodStart: month } };
    if (!v || (v.value == null && v.num == null)) {
      await prisma.perfValue.deleteMany({ where: { paramId: p.id, periodType: "MONTH", periodStart: month } });
      continue;
    }
    const data = { value: v.value ?? null, num: v.num ?? null, den: v.den ?? null, updatedById: null };
    await prisma.perfValue.upsert({ where: key, update: data, create: { ...data, paramId: p.id, periodType: "MONTH", periodStart: month } });
  }
  return { bulan: ym, final: Boolean(d.final), dilaksanakan: d.jumlah?.dilaksanakan ?? 0 };
}

// Tarik beberapa bulan; kegagalan per bulan dicatat tanpa menghentikan yang lain.
export async function syncMonths(months) {
  const ok = [];
  const failed = [];
  for (const ym of months) {
    try {
      ok.push(await syncMonth(ym));
    } catch (e) {
      failed.push({ bulan: ym, error: e?.message || String(e) });
    }
  }
  return { ok, failed };
}

// Bulan yang ditarik otomatis tiap hari: bulan lalu (final) & bulan berjalan (sementara).
export function defaultMonths() {
  const cur = todayKey().slice(0, 7);
  return [addMonth(cur, -1), cur];
}
