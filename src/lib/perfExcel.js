import ExcelJS from "exceljs";
import { PERF_GROUPS, PERF_KIND_LABELS, PERF_FREQ_LABELS } from "@/lib/constants";
import { normalizeStart, parseNumberLoose } from "@/lib/perfServer";
import { targetLabel } from "@/lib/perfcalc";

// Template Excel standar & pembacanya untuk impor data Performa RS.
// Kolom dikenali dari KODE di dalam kurung siku pada judul kolom, mis.
// "A · Kunjungan rawat jalan [rajal]" atau "C · Kepatuhan ... – pembilang [inm_hh.num]".

const SHEETS = { WEEK: "Mingguan", MONTH: "Bulanan" };
const TEAL = "FF0E7490";

function columnsFor(params, type) {
  const cols = [];
  for (const p of params.filter((x) => x.freq === type)) {
    const base = `${p.group} · ${p.name}`;
    if (p.kind === "RATIO") {
      cols.push({ header: `${base} – pembilang [${p.code}.num]`, code: p.code, field: "num" });
      cols.push({ header: `${base} – penyebut [${p.code}.den]`, code: p.code, field: "den" });
    } else if (p.kind === "SCORE") {
      cols.push({ header: `${base} – nilai [${p.code}.value]`, code: p.code, field: "value" });
      cols.push({ header: `${base} – responden [${p.code}.den]`, code: p.code, field: "den" });
    } else {
      cols.push({ header: `${base} [${p.code}]`, code: p.code, field: "value" });
    }
  }
  return cols;
}

function styleHeader(row) {
  row.height = 48;
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TEAL } };
    c.alignment = { wrapText: true, vertical: "middle" };
  });
}

export async function buildTemplate(params) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "RS CPL USU";

  // ---- Petunjuk ----
  const info = wb.addWorksheet("Petunjuk");
  info.columns = [{ width: 24 }, { width: 46 }, { width: 10 }, { width: 12 }, { width: 18 }, { width: 38 }, { width: 12 }];
  const lines = [
    ["Template Impor Data Performa RS — RS CPL USU"],
    [],
    ["Cara mengisi:"],
    ["1.", "Sheet \"Mingguan\": satu baris = satu minggu. Kolom pertama diisi tanggal SENIN minggu tsb (format 2025-01-06). Tanggal lain dalam minggu yang sama otomatis disesuaikan ke Senin."],
    ["2.", "Sheet \"Bulanan\": satu baris = satu bulan. Kolom pertama diisi bulan (format 2025-01)."],
    ["3.", "Isi angka saja (tanpa satuan). Untuk indikator mutu (INM) isi PEMBILANG dan PENYEBUT — persentase dihitung otomatis oleh sistem."],
    ["4.", "Sel yang dikosongkan dilewati (tidak menghapus data lama)."],
    ["5.", "Data periode yang sama dengan data yang sudah ada akan DITIMPA oleh isi file."],
    ["6.", "JANGAN mengubah judul kolom: kode dalam kurung siku [ ] dipakai sistem untuk mengenali kolom."],
    ["7.", "Di aplikasi: Performa RS → Input Data → Impor Excel → pilih file → Periksa file → Impor."],
    [],
    ["Daftar parameter:"],
    ["Kode", "Nama", "Kelompok", "Frekuensi", "Jenis", "Sumber data", "Target"],
  ];
  lines.forEach((l) => info.addRow(l));
  info.getCell("A1").font = { bold: true, size: 14 };
  info.getCell("A3").font = { bold: true };
  info.getCell("A12").font = { bold: true };
  for (let r = 4; r <= 10; r++) {
    info.mergeCells(`B${r}:G${r}`);
    info.getRow(r).alignment = { wrapText: true, vertical: "top" };
    info.getRow(r).height = 30;
  }
  styleHeader(info.getRow(13));
  info.getRow(13).height = 20;
  for (const p of params) {
    info.addRow([
      p.code,
      p.name,
      `${p.group} · ${PERF_GROUPS[p.group] || ""}`,
      PERF_FREQ_LABELS[p.freq],
      PERF_KIND_LABELS[p.kind]?.split(" (")[0],
      p.source || "",
      targetLabel(p),
    ]);
  }

  // ---- Sheet data ----
  for (const type of ["WEEK", "MONTH"]) {
    const ws = wb.addWorksheet(SHEETS[type], { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });
    const cols = columnsFor(params, type);
    ws.columns = [
      { header: type === "WEEK" ? "Minggu (tanggal Senin, YYYY-MM-DD)" : "Bulan (YYYY-MM)", width: 20 },
      ...cols.map((c) => ({ header: c.header, width: 18 })),
    ];
    styleHeader(ws.getRow(1));
    ws.getColumn(1).numFmt = "@"; // teks, agar tanggal tidak berubah format
  }

  return wb.xlsx.writeBuffer();
}

function cellValue(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellValue(v.result);
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return v.text;
  }
  return v;
}

const pad = (n) => String(n).padStart(2, "0");

// Ubah isi sel kolom pertama menjadi awal periode ("YYYY-MM-DD"), atau null.
function readPeriodCell(type, raw) {
  const v = cellValue(raw);
  if (v === null || v === "") return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return normalizeStart(type, v.toISOString().slice(0, 10));
  }
  const s = String(v).trim();
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return normalizeStart(type, `${m[1]}-${pad(m[2])}-${pad(m[3])}`);
  if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s))) return normalizeStart(type, `${m[3]}-${pad(m[2])}-${pad(m[1])}`);
  if (type === "MONTH" && (m = /^(\d{4})-(\d{1,2})$/.exec(s))) return normalizeStart(type, `${m[1]}-${pad(m[2])}`);
  if (type === "MONTH" && (m = /^(\d{1,2})[/.-](\d{4})$/.exec(s))) return normalizeStart(type, `${m[2]}-${pad(m[1])}`);
  return undefined; // ada isi tapi formatnya tidak dikenali
}

// Baca workbook -> daftar isian per periode.
// Hasil: { periods: [{ type, start, sheet, row, input: { [code]: {field: value} } }], errors: [] }
export async function parseWorkbook(buffer, params) {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer);
  } catch {
    return { periods: [], errors: ["File tidak dapat dibaca. Pastikan formatnya .xlsx (Excel)."] };
  }
  const known = new Map(params.map((p) => [p.code, p]));
  const periods = [];
  const errors = [];
  let sheetsFound = 0;

  for (const type of ["WEEK", "MONTH"]) {
    const ws = wb.getWorksheet(SHEETS[type]);
    if (!ws) continue;
    sheetsFound++;
    const colMap = new Map();
    ws.getRow(1).eachCell((cell, col) => {
      if (col === 1) return;
      const text = String(cellValue(cell.value) ?? "");
      const m = /\[([a-z0-9_]+)(?:\.(value|num|den))?\]\s*$/i.exec(text);
      if (!m) return;
      const p = known.get(m[1]);
      if (!p) {
        errors.push(`Sheet ${SHEETS[type]}: kolom "${text}" tidak dikenal (parameter tidak ada / nonaktif).`);
        return;
      }
      if (p.freq !== type) {
        errors.push(`Sheet ${SHEETS[type]}: kolom "${p.name}" seharusnya di sheet ${SHEETS[p.freq]}.`);
        return;
      }
      colMap.set(col, { code: p.code, field: m[2] || "value" });
    });

    const seen = new Map();
    ws.eachRow((row, r) => {
      if (r === 1) return;
      const input = {};
      let hasValue = false;
      for (const [col, { code, field }] of colMap) {
        const v = cellValue(row.getCell(col).value);
        if (v === null || v === "") continue;
        const n = parseNumberLoose(v);
        if (Number.isNaN(n)) {
          errors.push(`Sheet ${SHEETS[type]} baris ${r}: "${v}" bukan angka (${known.get(code).name}).`);
          continue;
        }
        input[code] = { ...(input[code] || {}), [field]: n };
        hasValue = true;
      }
      const start = readPeriodCell(type, row.getCell(1).value);
      if (start === null && !hasValue) return; // baris kosong
      if (!start) {
        errors.push(`Sheet ${SHEETS[type]} baris ${r}: ${type === "WEEK" ? "tanggal" : "bulan"} di kolom pertama tidak valid.`);
        return;
      }
      if (!hasValue) return;
      if (seen.has(start)) {
        errors.push(`Sheet ${SHEETS[type]} baris ${r}: periode ${start} sudah ada di baris ${seen.get(start)}.`);
        return;
      }
      seen.set(start, r);
      periods.push({ type, start, sheet: SHEETS[type], row: r, input });
    });
  }
  if (!sheetsFound) errors.push('Sheet "Mingguan" / "Bulanan" tidak ditemukan. Gunakan template dari aplikasi.');
  return { periods, errors };
}
