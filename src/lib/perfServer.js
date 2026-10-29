import { prisma } from "@/lib/prisma";
import { toKey, keyToDate, weekStartKey, isValidKey, todayKey } from "@/lib/logdate";
import { parseNumberLoose } from "@/lib/perfcalc";

export { parseNumberLoose };

// Utilitas server Performa RS: memuat parameter & data, serta validasi isian
// satu periode (dipakai bersama oleh form input dan impor Excel).

export const PARAM_FIELDS = {
  id: true, code: true, name: true, group: true, freq: true, kind: true, unit: true,
  source: true, targetOp: true, target: true, order: true, active: true, builtin: true,
};

export async function loadParams({ activeOnly = true } = {}) {
  return prisma.perfParam.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ group: "asc" }, { order: "asc" }, { id: "asc" }],
    select: PARAM_FIELDS,
  });
}

// Baris data mentah { code, type, start, value, num, den } sejak tanggal tertentu.
export async function loadRows(fromKey) {
  const vals = await prisma.perfValue.findMany({
    where: fromKey ? { periodStart: { gte: keyToDate(fromKey) } } : {},
    select: {
      periodType: true, periodStart: true, value: true, num: true, den: true,
      param: { select: { code: true } },
    },
  });
  return vals.map((v) => ({
    code: v.param.code,
    type: v.periodType,
    start: toKey(v.periodStart),
    value: v.value,
    num: v.num,
    den: v.den,
  }));
}

// Normalisasi awal periode: minggu -> Senin, bulan -> tanggal 1.
// Menerima "YYYY-MM-DD" (minggu/bulan) atau "YYYY-MM" (bulan).
export function normalizeStart(type, raw) {
  if (typeof raw !== "string") return null;
  if (type === "MONTH") {
    const m = /^(\d{4})-(0[1-9]|1[0-2])(-\d{2})?$/.exec(raw);
    return m ? `${m[1]}-${m[2]}-01` : null;
  }
  return isValidKey(raw) ? weekStartKey(raw) : null;
}

const FIELD_LABEL = { value: "nilai", num: "pembilang", den: "penyebut" };

// Validasi isian satu periode.
//   input: { [code]: { value?, num?, den? } }  (field kosong = tidak diisi)
// Hasil: { rows: [{ param, value, num, den, clear }], errors: [string] }
//   clear = true -> semua field kosong (data lama periode itu dihapus bila mode form)
export function validatePeriod(params, type, input) {
  const rows = [];
  const errors = [];
  for (const p of params.filter((x) => x.freq === type)) {
    const raw = input?.[p.code];
    if (raw === undefined) continue;
    const get = (f) => parseNumberLoose(raw?.[f]);
    const r = { param: p, value: null, num: null, den: null };
    const fields = p.kind === "RATIO" ? ["num", "den"] : p.kind === "SCORE" ? ["value", "den"] : ["value"];
    let bad = false;
    for (const f of fields) {
      const n = get(f);
      if (Number.isNaN(n)) {
        errors.push(`${p.name}: ${FIELD_LABEL[f] === "penyebut" && p.kind === "SCORE" ? "jumlah responden" : FIELD_LABEL[f]} harus berupa angka.`);
        bad = true;
      } else if (n !== null && n < 0) {
        errors.push(`${p.name}: tidak boleh negatif.`);
        bad = true;
      } else r[f] = n;
    }
    if (bad) continue;
    if (p.kind === "RATIO") {
      if ((r.num === null) !== (r.den === null)) {
        errors.push(`${p.name}: isi pembilang DAN penyebut (atau kosongkan keduanya).`);
        continue;
      }
      if (r.den === 0) { errors.push(`${p.name}: penyebut tidak boleh 0.`); continue; }
      if (r.num !== null && r.num > r.den) { errors.push(`${p.name}: pembilang tidak boleh melebihi penyebut.`); continue; }
    }
    if (p.kind === "SCORE") {
      if (r.value === null && r.den !== null) { errors.push(`${p.name}: isi nilai indeks.`); continue; }
      if (r.value !== null && r.value > 100) { errors.push(`${p.name}: nilai indeks maksimal 100.`); continue; }
    }
    r.clear = r.value === null && r.num === null && r.den === null;
    rows.push(r);
  }
  // Pemeriksaan silang sensus rawat inap: hari perawatan <= TT x 7 hari.
  const tt = rows.find((r) => r.param.code === "tt" && !r.clear)?.value;
  const hp = rows.find((r) => r.param.code === "hp" && !r.clear)?.value;
  if (type === "WEEK" && tt != null && hp != null && hp > tt * 7) {
    errors.push(`Jumlah hari perawatan (${hp}) melebihi kapasitas TT × 7 hari (${tt * 7}).`);
  }
  return { rows, errors };
}

export function isFuturePeriod(type, start) {
  return start > todayKey();
}

// Simpan hasil validasi satu periode (upsert; field kosong semua -> hapus bila clearEmpty).
export async function savePeriod(type, start, rows, userId, { clearEmpty = true } = {}) {
  const periodStart = keyToDate(start);
  const ops = [];
  for (const r of rows) {
    const where = { paramId_periodType_periodStart: { paramId: r.param.id, periodType: type, periodStart } };
    if (r.clear) {
      if (clearEmpty) {
        ops.push(prisma.perfValue.deleteMany({ where: { paramId: r.param.id, periodType: type, periodStart } }));
      }
      continue;
    }
    const data = { value: r.value, num: r.num, den: r.den, updatedById: userId };
    ops.push(prisma.perfValue.upsert({ where, update: data, create: { ...data, paramId: r.param.id, periodType: type, periodStart } }));
  }
  if (ops.length) await prisma.$transaction(ops);
  return ops.length;
}
