// Mesin hitung Performa RS (fungsi murni; dipakai di server & client).
//
// Data mentah berupa baris { code, type: "WEEK"|"MONTH", start: "YYYY-MM-DD",
// value, num, den }. Minggu dimulai Senin dan dihitung ke BULAN tempat hari
// Kamis-nya berada (mayoritas harinya), sehingga minggu yang terbelah dua bulan
// tidak terhitung ganda.

import { addDays, formatWeekRange, weekStartKey, keyToDate } from "@/lib/logdate";

export const GRANS = ["week", "month", "quarter", "semester", "year", "multi"];
// Urutan kelompok parameter (lihat PERF_GROUPS di constants).
export const PERF_GROUP_ORDER = ["A", "B", "C", "D", "E", "F"];
export const GRAN_LABELS = {
  week: "Mingguan",
  month: "Bulanan",
  quarter: "Triwulan",
  semester: "Semester",
  year: "Tahunan",
  multi: "Multi-tahun",
};
// Jumlah periode yang ditampilkan pada grafik tren.
export const TREND_LENGTH = { week: 12, month: 12, quarter: 8, semester: 6, year: 5, multi: 5 };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const ROMAN = ["I", "II", "III", "IV"];

export const monthOfWeek = (weekStart) => addDays(weekStart, 3).slice(0, 7);
const pad = (n) => String(n).padStart(2, "0");
const ymKey = (y, m) => `${y}-${pad(m + 1)}`; // m: 0-11

// ---------- Periode ----------
export function isValidPeriodKey(gran, key) {
  if (typeof key !== "string") return false;
  const re = {
    week: /^\d{4}-\d{2}-\d{2}$/,
    month: /^\d{4}-(0[1-9]|1[0-2])$/,
    quarter: /^\d{4}-Q[1-4]$/,
    semester: /^\d{4}-S[12]$/,
    year: /^\d{4}$/,
    multi: /^\d{4}$/,
  }[gran];
  if (!re || !re.test(key)) return false;
  return gran !== "week" || weekStartKey(key) === key;
}

export function currentPeriodKey(gran, todayKey) {
  const y = Number(todayKey.slice(0, 4));
  const m = Number(todayKey.slice(5, 7)) - 1;
  switch (gran) {
    case "week": return weekStartKey(todayKey);
    case "month": return ymKey(y, m);
    case "quarter": return `${y}-Q${Math.floor(m / 3) + 1}`;
    case "semester": return `${y}-S${m < 6 ? 1 : 2}`;
    default: return String(y);
  }
}

// Geser periode sebanyak n (negatif = mundur).
export function shiftPeriod(gran, key, n) {
  if (gran === "week") return addDays(key, 7 * n);
  const y = Number(key.slice(0, 4));
  if (gran === "month") {
    const idx = y * 12 + Number(key.slice(5, 7)) - 1 + n;
    return ymKey(Math.floor(idx / 12), ((idx % 12) + 12) % 12);
  }
  if (gran === "quarter" || gran === "semester") {
    const per = gran === "quarter" ? 4 : 2;
    const idx = y * per + Number(key.slice(6)) - 1 + n;
    return `${Math.floor(idx / per)}-${gran === "quarter" ? "Q" : "S"}${(((idx % per) + per) % per) + 1}`;
  }
  return String(y + n);
}

// Deskripsi periode: label, label singkat (sumbu grafik), daftar bulan / minggu.
export function makePeriod(gran, key) {
  const y = Number(key.slice(0, 4));
  if (gran === "week") {
    const d = keyToDate(key);
    return {
      gran, key, week: key, months: null,
      label: formatWeekRange(key),
      short: `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`,
    };
  }
  if (gran === "month") {
    const m = Number(key.slice(5, 7)) - 1;
    return { gran, key, week: null, months: [key], label: `${MONTHS_LONG[m]} ${y}`, short: `${MONTHS[m]} ${String(y).slice(2)}` };
  }
  if (gran === "quarter") {
    const q = Number(key.slice(6)) - 1;
    const months = [0, 1, 2].map((i) => ymKey(y, q * 3 + i));
    return { gran, key, week: null, months, label: `Triwulan ${ROMAN[q]} ${y}`, short: `TW ${ROMAN[q]} ${String(y).slice(2)}` };
  }
  if (gran === "semester") {
    const s = Number(key.slice(6)) - 1;
    const months = Array.from({ length: 6 }, (_, i) => ymKey(y, s * 6 + i));
    return { gran, key, week: null, months, label: `Semester ${s ? "II" : "I"} ${y}`, short: `S${s + 1} ${String(y).slice(2)}` };
  }
  const months = Array.from({ length: 12 }, (_, i) => ymKey(y, i));
  return { gran, key, week: null, months, label: String(y), short: String(y) };
}

export function periodSeries(gran, key, count) {
  return Array.from({ length: count }, (_, i) => shiftPeriod(gran, key, i - count + 1));
}

// ---------- Agregasi ----------
function indexRows(rows) {
  const byCode = new Map();
  for (const r of rows) {
    if (!byCode.has(r.code)) byCode.set(r.code, []);
    byCode.get(r.code).push(r);
  }
  return byCode;
}

function rowInPeriod(r, period) {
  if (period.week) {
    return r.type === "WEEK" ? r.start === period.week : r.start.slice(0, 7) === monthOfWeek(period.week);
  }
  const month = r.type === "WEEK" ? monthOfWeek(r.start) : r.start.slice(0, 7);
  return period.months.includes(month);
}

function combine(kind, rows) {
  const num = (x) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  if (kind === "COUNT") {
    const vs = rows.map((r) => num(r.value)).filter((v) => v !== null);
    return vs.length ? { v: vs.reduce((s, v) => s + v, 0), n: vs.length } : null;
  }
  if (kind === "STOCK") {
    const vs = rows.filter((r) => num(r.value) !== null).sort((a, b) => a.start.localeCompare(b.start));
    return vs.length ? { v: vs[vs.length - 1].value, n: vs.length } : null;
  }
  if (kind === "RATIO") {
    const vs = rows.filter((r) => num(r.num) !== null && num(r.den) !== null);
    const N = vs.reduce((s, r) => s + r.num, 0);
    const D = vs.reduce((s, r) => s + r.den, 0);
    return D > 0 ? { v: (N / D) * 100, num: N, den: D, n: vs.length } : null;
  }
  if (kind === "SCORE") {
    const vs = rows.filter((r) => num(r.value) !== null);
    const W = vs.reduce((s, r) => s + (num(r.den) > 0 ? r.den : 1), 0);
    if (!W) return null;
    const v = vs.reduce((s, r) => s + r.value * (num(r.den) > 0 ? r.den : 1), 0) / W;
    return { v, den: vs.reduce((s, r) => s + (num(r.den) || 0), 0), n: vs.length };
  }
  return null;
}

// ---------- Barber-Johnson ----------
export const BJ_DEFS = [
  { code: "bor", name: "BOR", desc: "Pemakaian tempat tidur", min: 60, max: 85, ideal: "60–85%" },
  { code: "alos", name: "ALOS", desc: "Rata-rata lama dirawat", min: 6, max: 9, ideal: "6–9 hari" },
  { code: "toi", name: "TOI", desc: "Rata-rata TT kosong", min: 1, max: 3, ideal: "1–3 hari" },
  { code: "bto", name: "BTO", desc: "Frekuensi pemakaian TT (disetahunkan)", min: 40, max: 50, ideal: "40–50 kali/thn" },
  { code: "gdr", name: "GDR", desc: "Angka kematian kasar", min: null, max: 45, ideal: "< 45‰" },
  { code: "ndr", name: "NDR", desc: "Angka kematian ≥ 48 jam", min: null, max: 25, ideal: "< 25‰" },
];

function barberJohnson(weekRows) {
  const sum = (code) => {
    const vs = (weekRows.get(code) || []).map((r) => r.value).filter((v) => Number.isFinite(v));
    return vs.length ? vs.reduce((s, v) => s + v, 0) : null;
  };
  const ttRows = (weekRows.get("tt") || []).filter((r) => Number.isFinite(r.value) && r.value > 0);
  const days = ttRows.length * 7;
  const ttDays = ttRows.reduce((s, r) => s + r.value * 7, 0);
  const hp = sum("hp");
  const ld = sum("ld");
  const hidup = sum("keluar_hidup");
  const lt48 = sum("mati_lt48");
  const ge48 = sum("mati_ge48");
  const anyOut = hidup !== null || lt48 !== null || ge48 !== null;
  const keluar = (hidup || 0) + (lt48 || 0) + (ge48 || 0);
  const mati = (lt48 || 0) + (ge48 || 0);
  const out = {};
  out.bor = ttDays > 0 && hp !== null ? (hp / ttDays) * 100 : null;
  out.alos = anyOut && keluar > 0 && ld !== null ? ld / keluar : null;
  out.toi = anyOut && keluar > 0 && ttDays > 0 && hp !== null ? (ttDays - hp) / keluar : null;
  out.bto = anyOut && keluar > 0 && days > 0 ? (keluar / (ttDays / days)) * (365 / days) : null;
  out.gdr = anyOut && keluar > 0 ? (mati / keluar) * 1000 : null;
  out.ndr = anyOut && keluar > 0 ? ((ge48 || 0) / keluar) * 1000 : null;
  return out;
}

// Nilai semua parameter + indikator Barber-Johnson untuk satu periode.
export function aggregate(params, rows, period, index = indexRows(rows)) {
  const values = {};
  const weekRows = new Map();
  for (const p of params) {
    const rs = (index.get(p.code) || []).filter((r) => rowInPeriod(r, period));
    values[p.code] = combine(p.kind, rs);
    if (p.freq === "WEEK") weekRows.set(p.code, rs.filter((r) => r.type === "WEEK"));
  }
  const bj = barberJohnson(weekRows);
  for (const d of BJ_DEFS) values[d.code] = bj[d.code] === null ? null : { v: bj[d.code] };
  return values;
}

// Seri tren: nilai tiap kode untuk `count` periode terakhir s.d. `key`.
export function trend(params, rows, gran, key, count = TREND_LENGTH[gran]) {
  const index = indexRows(rows);
  const keys = periodSeries(gran === "multi" ? "year" : gran, key, count);
  const periods = keys.map((k) => makePeriod(gran === "multi" ? "year" : gran, k));
  const series = {};
  const codes = [...params.map((p) => p.code), ...BJ_DEFS.map((d) => d.code)];
  for (const c of codes) series[c] = [];
  for (const per of periods) {
    const agg = aggregate(params, rows, per, index);
    for (const c of codes) series[c].push(agg[c]?.v ?? null);
  }
  return { periods: periods.map(({ key: k, label, short }) => ({ key: k, label, short })), series };
}

// Perbandingan multi-tahun: nilai bulanan (12 titik) per tahun untuk tiap kode.
export function monthlyByYear(params, rows, years) {
  const index = indexRows(rows);
  const out = {};
  const codes = [...params.map((p) => p.code), ...BJ_DEFS.map((d) => d.code)];
  for (const c of codes) out[c] = {};
  for (const y of years) {
    for (const c of codes) out[c][y] = [];
    for (let m = 0; m < 12; m++) {
      const agg = aggregate(params, rows, makePeriod("month", ymKey(y, m)), index);
      for (const c of codes) out[c][y].push(agg[c]?.v ?? null);
    }
  }
  return out;
}

// ---------- Status & format ----------
// Target: Memenuhi / Mendekati (selisih <= 5 poin) / Di bawah target.
export const NEAR_MARGIN = 5;
export function targetStatus(param, v) {
  if (v === null || v === undefined || param?.target === null || param?.target === undefined) return null;
  const t = param.target;
  if (param.targetOp === "LTE") return v <= t ? "good" : v - t <= NEAR_MARGIN ? "warn" : "crit";
  return v >= t ? "good" : t - v <= NEAR_MARGIN ? "warn" : "crit";
}
export const STATUS_TEXT = { good: "Memenuhi", warn: "Mendekati", crit: "Di bawah target" };

export function bjStatus(def, v) {
  if (v === null || v === undefined) return null;
  if ((def.min !== null && v < def.min) || (def.max !== null && v > def.max)) return "warn";
  return "good";
}
export const BJ_STATUS_TEXT = { good: "Ideal", warn: "Di luar rentang" };

export function targetLabel(param) {
  if (param?.target === null || param?.target === undefined) return "—";
  const t = param.kind === "SCORE" ? fmt(param.target, 2) : `${fmt(param.target, 0)}%`;
  return `${param.targetOp === "LTE" ? "≤" : "≥"} ${t}`;
}

export function fmt(v, digits = 0) {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return v.toLocaleString("id-ID", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatParam(param, v) {
  if (v === null || v === undefined) return "—";
  if (param.kind === "RATIO") return `${fmt(v, 1)}%`;
  if (param.kind === "SCORE") return fmt(v, 2);
  return fmt(v, 0);
}

export function formatBJ(code, v) {
  if (v === null || v === undefined) return "—";
  switch (code) {
    case "bor": return `${fmt(v, 1)}%`;
    case "alos":
    case "toi": return `${fmt(v, 1)} hari`;
    case "bto": return `${fmt(v, 0)} kali/thn`;
    default: return `${fmt(v, 1)}‰`;
  }
}

export function pctChange(cur, prev) {
  if (cur === null || cur === undefined || !prev) return null;
  return ((cur - prev) / prev) * 100;
}

// Angka "longgar": 1056, "1.056" (titik ribuan), "79,2" (koma desimal), "1,056.5".
export function parseNumberLoose(input) {
  if (input === null || input === undefined || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : NaN;
  let s = String(input).trim().replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
  else s = s.replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}
