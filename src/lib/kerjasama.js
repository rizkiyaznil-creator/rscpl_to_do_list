// Logika bersama (server & browser) menu Kerjasama: label, jadwal evaluasi
// wajib, alarm, status, dan kelengkapan data. Tanggal memakai kunci "YYYY-MM-DD".

export const KS_TIPE = [
  ["PENDIDIKAN", "Kerjasama Pendidikan"],
  ["OPERASIONAL", "Kerjasama Operasional"],
  ["PELAYANAN", "Kerjasama Pelayanan"],
  ["PENYEDIAAN", "Kerjasama Penyediaan"],
  ["PENELITIAN", "Kerjasama Penelitian"],
  ["LAINNYA", "Kerjasama Lainnya"],
];
export const KS_TIPE_LABEL = Object.fromEntries(KS_TIPE);

export const KS_JENIS_MITRA = [
  ["INSTITUSI", "Institusi (pemerintah/pendidikan/RS)"],
  ["BADAN_USAHA", "Badan usaha"],
  ["LAINNYA", "Badan lainnya"],
];
export const KS_JENIS_MITRA_LABEL = Object.fromEntries(KS_JENIS_MITRA);

export const KS_EVAL_BULAN = [1, 3, 6, 12];

export const KS_HASIL = [
  ["SESUAI", "Baik / sesuai"],
  ["PERBAIKAN", "Perlu perbaikan"],
  ["TIDAK_SESUAI", "Tidak sesuai"],
];
export const KS_HASIL_LABEL = Object.fromEntries(KS_HASIL);

export const KS_REKOMENDASI = [
  ["LANJUT", "Lanjut"],
  ["LANJUT_PERBAIKAN", "Lanjut dengan perbaikan"],
  ["HENTIKAN", "Dihentikan"],
];
export const KS_REKOMENDASI_LABEL = Object.fromEntries(KS_REKOMENDASI);

// Batas alarm (hari).
export const KS_EVAL_SOON_DAYS = 14;
export const KS_END_SOON_DAYS = 90;
export const KS_END_URGENT_DAYS = 30;
export const KS_ENDED_ALARM_DAYS = 30; // alarm "berakhir" tampil s.d. 30 hari sesudahnya

// ── Tanggal ──
const pad = (n) => String(n).padStart(2, "0");
export const toYmd = (v) => {
  if (!v) return null;
  if (typeof v === "string") return v.slice(0, 10);
  return new Date(v).toISOString().slice(0, 10);
};
export function addMonthsKey(key, months) {
  const [y, m, d] = key.split("-").map(Number);
  const idx = y * 12 + (m - 1) + months;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${pad(nm)}-${pad(Math.min(d, last))}`;
}
export function daysBetween(fromKey, toKey) {
  return Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86_400_000);
}
const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export function fmtTgl(key) {
  if (!key) return "—";
  const [y, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_ID[m - 1]} ${y}`;
}

// Nama mitra ringkas, mis. "A" / "A, B & C".
export function mitraNames(k) {
  const names = (k.mitra || []).map((m) => m.nama).filter(Boolean);
  if (names.length <= 1) return names[0] || "—";
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
export const isMultipihak = (k) => (k.mitra || []).length >= 2;
export const multipihakLabel = (k) => ((k.mitra || []).length === 2 ? "Tripartit" : "Multipihak");

// ── Jadwal evaluasi wajib ──
// Jadwal ke-n = tanggal mulai + n × periode, sampai tanggal berakhir (bila ada).
// Jadwal sebelum `wajibEvalSejak` (tanggal data dicatat di aplikasi) tidak diwajibkan.
export function evalSchedule(k, today) {
  if (!k.evalBulan || !k.mulai) return [];
  const mulai = toYmd(k.mulai);
  const end = toYmd(k.berakhir);
  const sejak = toYmd(k.wajibEvalSejak) || mulai;
  const horizon = end || addMonthsKey(today, k.evalBulan * 2);
  const byKe = new Map((k.evaluasi || []).map((e) => [e.ke, e]));
  const out = [];
  for (let n = 1; n <= 240; n++) {
    const due = addMonthsKey(mulai, n * k.evalBulan);
    if (due > horizon) break;
    out.push({ ke: n, due, wajib: due >= sejak, evaluasi: byKe.get(n) || null });
  }
  return out;
}

// Status tampilan sebuah kerjasama.
export function ksStatus(k, today) {
  if (k.status === "MENUNGGU") return { key: "MENUNGGU", label: "Menunggu verifikasi", tone: "warn" };
  if (k.status === "DIKEMBALIKAN") return { key: "DIKEMBALIKAN", label: "Dikembalikan", tone: "danger" };
  if (k.perpanjangan?.status === "FINAL") return { key: "DIPERPANJANG", label: "Diperpanjang", tone: "muted" };
  const end = toYmd(k.berakhir);
  if (end && end < today) return { key: "BERAKHIR", label: "Berakhir", tone: "muted" };
  if (end && daysBetween(today, end) <= KS_END_SOON_DAYS) return { key: "AKAN_BERAKHIR", label: "Akan berakhir", tone: "warn" };
  return { key: "AKTIF", label: "Aktif", tone: "ok" };
}

// Alarm aktif sebuah kerjasama FINAL: [{ kind, level: "danger"|"warn"|"info", label, ke? }]
// kind untuk email: EVAL_H14:<ke> | EVAL_LATE:<ke> | END_H90 | END_H30 | ENDED
export function ksAlarms(k, today) {
  if (k.status !== "FINAL") return [];
  const out = [];
  const end = toYmd(k.berakhir);
  const extended = k.perpanjangan?.status === "FINAL";
  const ended = end && end < today;

  // Evaluasi wajib (hanya selama kerjasama masih berjalan).
  if (!ended && !extended) {
    const open = evalSchedule(k, today).filter((s) => s.wajib && s.evaluasi?.status !== "FINAL");
    const late = open.filter((s) => s.due < today && s.evaluasi?.status !== "MENUNGGU");
    const pending = open.filter((s) => s.evaluasi?.status === "MENUNGGU" && s.due <= addDaysKey(today, KS_EVAL_SOON_DAYS));
    if (late.length) {
      const s = late[0];
      out.push({
        kind: `EVAL_LATE:${s.ke}`,
        level: "danger",
        ke: s.ke,
        label: `Evaluasi ke-${s.ke} terlambat ${daysBetween(s.due, today)} hari${late.length > 1 ? ` (${late.length} jadwal belum dievaluasi)` : ""}`,
      });
    } else {
      const soon = open.find((s) => s.due >= today && daysBetween(today, s.due) <= KS_EVAL_SOON_DAYS && s.evaluasi?.status !== "MENUNGGU");
      if (soon) {
        const d = daysBetween(today, soon.due);
        out.push({ kind: `EVAL_H14:${soon.ke}`, level: "warn", ke: soon.ke, label: `Evaluasi ke-${soon.ke} ${d === 0 ? "jatuh tempo hari ini" : `dalam ${d} hari`} (${fmtTgl(soon.due)})` });
      }
    }
    if (pending.length) out.push({ kind: "EVAL_PENDING", level: "info", label: `Hasil evaluasi ke-${pending[0].ke} menunggu verifikasi` });
    if (!k.evalBulan) out.push({ kind: "EVAL_NONE", level: "info", label: "Periode evaluasi wajib belum diisi" });
  }

  // Masa kerjasama.
  if (end && !extended) {
    const d = daysBetween(today, end);
    if (d < 0 && -d <= KS_ENDED_ALARM_DAYS) out.push({ kind: "ENDED", level: "danger", label: `Kerjasama berakhir ${-d} hari lalu (${fmtTgl(end)})` });
    else if (d >= 0 && d <= KS_END_URGENT_DAYS) out.push({ kind: "END_H30", level: "danger", label: `Berakhir ${d === 0 ? "hari ini" : `dalam ${d} hari`} (${fmtTgl(end)})` });
    else if (d > KS_END_URGENT_DAYS && d <= KS_END_SOON_DAYS) out.push({ kind: "END_H90", level: "warn", label: `Berakhir dalam ${d} hari (${fmtTgl(end)})` });
  }
  return out;
}

export function addDaysKey(key, n) {
  const t = Date.parse(`${key}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

// Evaluasi wajib berikutnya yang belum final (untuk kolom tabel).
export function nextEval(k, today) {
  const s = evalSchedule(k, today).find((x) => x.wajib && x.evaluasi?.status !== "FINAL");
  return s || null;
}

// Field wajib yang belum lengkap (data impor / data lama).
export function missingFields(k) {
  const miss = [];
  if (!k.evalBulan) miss.push("periode evaluasi");
  if (!k.linkDokumen) miss.push("link dokumen");
  if (!k.nomorDokumen) miss.push("nomor dokumen");
  if (!k.bidang) miss.push("bidang");
  if (!k.isi) miss.push("isi ringkas");
  const mitra = k.mitra || [];
  if (!mitra.length) miss.push("mitra");
  if (mitra.some((m) => !m.pimpinan)) miss.push("nama pimpinan mitra");
  if (mitra.some((m) => !m.kontakPic)) miss.push("kontak PIC mitra");
  return miss;
}

// Token nomor dokumen untuk mendeteksi duplikat: "A dan B, C" -> ["a","b","c"]
// (huruf kecil, tanpa spasi). Nomor "-"/kosong diabaikan.
export function nomorTokens(s) {
  return String(s || "")
    .split(/\s+(?:dan|dam|and)\s+|,|;|\n/i)
    .map((t) => t.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9/.\-]/g, ""))
    .filter((t) => t.length >= 4 && /\d/.test(t));
}

// Kunci duplikat = token nomor dokumen + awal nama mitra pertama, agar dua
// kerjasama berbeda yang kebetulan bernomor sama (data lama) tidak dianggap ganda.
export function dupKeys(nomorDokumen, mitraNama) {
  const nm = String(mitraNama || "").toLowerCase().replace(/[^a-z0-9]/g, "").replace(/^(pt|cv|ud)/, "").slice(0, 14);
  return nomorTokens(nomorDokumen).map((t) => `${t}|${nm}`);
}
