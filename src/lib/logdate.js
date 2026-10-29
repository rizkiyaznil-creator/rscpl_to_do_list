// Helper tanggal & jam untuk logbook (aman dipakai di client maupun server).
// Tanggal diwakili string "YYYY-MM-DD" menurut kalender WIB (UTC+7);
// di database disimpan sebagai kolom DATE.

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const DAY_NAMES = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

// Tanggal hari ini (WIB).
export function todayKey() {
  return new Date(Date.now() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

// Nilai kolom DATE dari database (tengah malam UTC) -> "YYYY-MM-DD".
export function toKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

export function keyToDate(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

export function isValidKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  return toKey(keyToDate(key)) === key;
}

export function addDays(key, n) {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 0 = Senin ... 6 = Minggu
export function dayIndex(key) {
  return (keyToDate(key).getUTCDay() + 6) % 7;
}

// Senin pada minggu yang memuat `key`.
export function weekStartKey(key) {
  return addDays(key, -dayIndex(key));
}

export function isWeekday(key) {
  return dayIndex(key) < 5;
}

// "HH:MM" -> menit sejak tengah malam (null bila tidak valid).
export function parseTime(value) {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Durasi kegiatan dalam menit. Jam selesai <= jam mulai dianggap melewati
// tengah malam (mis. jaga malam 21:00-07:00). Null bila jam tidak valid.
export function durationMinutes(start, end) {
  const s = parseTime(start);
  const e = parseTime(end);
  if (s === null || e === null || s === e) return null;
  return e > s ? e - s : e + 1440 - s;
}

export function formatMinutes(total) {
  const m = Math.max(0, Math.round(total || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} mnt`;
  return r ? `${h} j ${r} mnt` : `${h} jam`;
}

// "2026-10-29" -> "Kamis, 29 Okt 2026"
export function formatDayKey(key, withDayName = true) {
  const text = keyToDate(key).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return withDayName ? `${DAY_NAMES[dayIndex(key)]}, ${text}` : text;
}

// Label rentang minggu, mis. "27 Okt – 2 Nov 2026".
export function formatWeekRange(weekStart) {
  const end = addDays(weekStart, 6);
  const a = keyToDate(weekStart).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${a} – ${formatDayKey(end, false)}`;
}

export function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
