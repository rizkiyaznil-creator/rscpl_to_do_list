// Pembaca Laporan Rekam Medis bulanan (Excel dari Unit Rekam Medis).
// Tiap bulan = 3 lembar: RJ-<bulan><tahun>, IGD-..., RI-... (mis. "RJ-1026").
// Dibaca berdasarkan JUDUL KOLOM (bukan posisi tetap) agar format lama (2025)
// dan baru (2026) sama-sama terbaca. Dipakai di browser (unggah) — hasilnya
// JSON ringkas yang dikirim ke server.

const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const cellVal = (c) => {
  let v = c.value;
  if (v && typeof v === "object") v = v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join("") : null);
  return v;
};

function load(ws) {
  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells = {};
    row.eachCell({ includeEmpty: false }, (c, i) => {
      const v = cellVal(c);
      if (v !== null && v !== undefined && v !== "") cells[i] = typeof v === "string" ? norm(v) : v;
    });
    rows.push({ cells });
  });
  return rows;
}
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const nums = (row) => Object.entries(row.cells).filter(([, v]) => isNum(v)).map(([i, v]) => [+i, v]);
const lastNum = (row) => nums(row).pop()?.[1] ?? null;
const firstStr = (row) => Object.values(row.cells).find((v) => typeof v === "string") || "";

const PENJAMIN = [
  [/BPJS.*(TK|Ketenagakerjaan)/i, "bpjsTk"],
  [/BPJS/i, "bpjs"],
  [/IOM/i, "iom"],
  [/(Jasa Raharja|^J ?R$)/i, "jasaRaharja"],
  [/(Umum|Pribadi)/i, "umum"],
  [/Asuransi/i, "asuransiLain"],
];
const penjaminKey = (s) => PENJAMIN.find(([re]) => re.test(s))?.[1];

// Tabel dengan sel judul kolom label `headRe` -> { items: [{nama, jumlah, icd?}], total, penjamin }.
function table(rows, headRe, { icd = false } = {}) {
  const h = rows.findIndex((x) => Object.values(x.cells).some((v) => typeof v === "string" && headRe.test(v)));
  if (h < 0) return null;
  const head = rows[h].cells;
  const labelCol = +Object.keys(head).find((k) => typeof head[k] === "string" && headRe.test(head[k]));
  const jumlahCol = Math.max(-1, ...Object.keys(head).filter((k) => /^jumlah$/i.test(String(head[k]))).map(Number));
  const icdCol = icd ? +Object.keys(head).find((k) => /ICD/i.test(String(head[k]))) || null : null;
  const groups = {};
  for (const [k, v] of Object.entries(head)) {
    const key = typeof v === "string" ? penjaminKey(v) : null;
    if (key) (groups[key] ||= []).push(+k);
  }
  const items = [];
  const raw = [];
  let total = null;
  for (let i = h + 1; i < rows.length; i++) {
    const x = rows[i];
    const label = typeof x.cells[labelCol] === "string" ? x.cells[labelCol] : firstStr(x);
    const anyNum = nums(x).length > 0;
    if (!label && !anyNum) continue;
    if (headRe.test(label) || /^(L|P|No\.?)$/i.test(label)) continue; // baris judul kedua
    const first = firstStr(x);
    if (/^(total|jumlah|t o t a l)/i.test(first) && !/^jumlah pasien/i.test(first)) {
      total = jumlahCol > 0 && isNum(x.cells[jumlahCol]) ? x.cells[jumlahCol] : lastNum(x);
      break;
    }
    if (!anyNum && /^[A-Z0-9 .,()/&-]{8,}$/.test(label) && items.length) break; // judul bagian berikutnya
    if (!label || !anyNum) continue;
    const jumlah = jumlahCol > 0 && isNum(x.cells[jumlahCol]) ? x.cells[jumlahCol] : lastNum(x);
    const it = { nama: label, jumlah };
    if (icdCol) it.icd = x.cells[icdCol] ? String(x.cells[icdCol]) : null;
    items.push(it);
    raw.push(x);
  }
  let penjamin = null;
  if (Object.keys(groups).length > 1) {
    penjamin = {};
    for (const [k, cols] of Object.entries(groups)) {
      penjamin[k] = raw.reduce((s, x) => s + cols.reduce((a, c) => a + (isNum(x.cells[c]) ? x.cells[c] : 0), 0), 0);
    }
  }
  return { items, total, penjamin };
}

function findValue(rows, re) {
  for (const x of rows) {
    const e = Object.entries(x.cells);
    const hit = e.find(([, v]) => typeof v === "string" && re.test(v));
    if (!hit) continue;
    const after = e.filter(([k, v]) => +k > +hit[0] && isNum(v));
    if (after.length) return after[0][1];
  }
  return null;
}
const rowTotal = (rows, re) => {
  const x = rows.find((y) => Object.values(y.cells).some((v) => typeof v === "string" && re.test(v)));
  return x ? lastNum(x) : null;
};

function parseRJ(ws) {
  const rows = load(ws);
  const poli = table(rows, /^Poliklinik$/i);
  const jenis = table(rows, /^JENIS OPERASI$/i);
  return {
    total: rowTotal(rows, /^Total Kunjungan Pasien$/i) ?? rowTotal(rows, /^TOTAL PASIEN$/i) ?? poli?.total ?? null,
    baru: rowTotal(rows, /^Jumlah Pasien Baru/i),
    lama: rowTotal(rows, /^Jumlah Pasien Lama/i),
    pmksPpds: rowTotal(rows, /^Jumlah Pasien PMKS/i),
    baksos: rowTotal(rows, /^Jumlah Pasien BAKSOS/i),
    penjamin: poli?.penjamin ?? null,
    perPoli: poli?.items ?? [],
    penunjang: table(rows, /^Instalasi$/i)?.items ?? [],
    top10: (table(rows, /^(Diagnosa|Penyakit)$/i, { icd: true })?.items ?? []).slice(0, 10),
    ibp: {
      total: rowTotal(rows, /^Total Pasien Bedah$/i) ?? jenis?.total ?? null,
      perJenis: jenis?.items ?? [],
      perSub: table(rows, /^SUB SPESIALIS BEDAH$/i)?.items ?? [],
    },
  };
}

function parseIGD(ws) {
  const rows = load(ws);
  const dept = table(rows, /^(Spesialisasi|KSM)$/i);
  return {
    total: dept?.total ?? null,
    penjamin: dept?.penjamin ?? null,
    perSpesialis: dept?.items ?? [],
    caraDatang: table(rows, /^CARA DATANG$/i)?.items ?? [],
    caraKeluar: table(rows, /^(CARA KELUAR|Cara Pulang)$/i)?.items ?? [],
  };
}

function parseRI(ws) {
  const rows = load(ws);
  const ruang = table(rows, /^RUANGAN$/i);
  const ket = table(rows, /^KETERANGAN PASIEN$/i)?.items ?? [];
  const pick = (re) => ket.find((k) => re.test(k.nama))?.jumlah ?? null;
  return {
    total: ruang?.total ?? null,
    penjamin: ruang?.penjamin ?? null,
    perRuang: ruang?.items ?? [],
    perSpesialis: table(rows, /^SPESIALIS$/i)?.items ?? [],
    paps: pick(/^PAPS/i),
    dirujuk: pick(/^DIRUJUK/i),
    meninggal: pick(/^EXIT/i),
    doa: pick(/^DOA/i),
    bor: findValue(rows, /^BOR\b/),
    los: findValue(rows, /^A?LOS\b/),
    toi: findValue(rows, /^TOI\b/),
    btoBulan: findValue(rows, /^BTO\b/),
    ndr: findValue(rows, /^NDR\b/),
    gdr: findValue(rows, /^GDR\b/),
    podr: findValue(rows, /^PODR\b/),
    nmr: findValue(rows, /^NMR\b/),
    imr: findValue(rows, /^IMR\b/),
    mmr: findValue(rows, /^MMR\b/),
    top10: (table(rows, /^(Diagnosa|PENYAKIT)$/i, { icd: true })?.items ?? []).slice(0, 10),
  };
}

// Baca satu workbook -> [{ bulan, file, modified, rj, igd, ri }] (satu per bulan
// yang berisi data; lembar bulan kosong dilewati).
export async function parseRmWorkbook(buffer, fileName) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const groups = new Map();
  for (const ws of wb.worksheets) {
    const m = /^(RJ|IGD|RI)\s*-\s*(\d{1,2})(\d{2})$/i.exec(ws.name.trim());
    if (!m || +m[2] < 1 || +m[2] > 12) continue;
    const ym = `20${m[3]}-${m[2].padStart(2, "0")}`;
    if (!groups.has(ym)) groups.set(ym, {});
    groups.get(ym)[m[1].toUpperCase()] = ws;
  }
  const out = [];
  for (const [bulan, g] of groups) {
    const rec = {
      bulan,
      file: fileName,
      modified: wb.modified ? new Date(wb.modified).toISOString() : null,
      rj: g.RJ ? parseRJ(g.RJ) : null,
      igd: g.IGD ? parseIGD(g.IGD) : null,
      ri: g.RI ? parseRI(g.RI) : null,
    };
    if (rec.rj?.total || rec.igd?.total || rec.ri?.total) out.push(rec);
  }
  return out;
}

// Banyak file (xlsx / zip berisi xlsx) -> laporan terbaru per bulan.
// files: [{ name, buffer }]. Revisi terbaru = tanggal simpan workbook terakhir.
export async function parseRmFiles(files, onProgress) {
  const all = [];
  const errors = [];
  const queue = [];
  for (const f of files) {
    if (/\.zip$/i.test(f.name)) {
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(f.buffer);
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.xlsx$/i.test(entry.name) || /(^|\/)(__MACOSX|~\$)/.test(entry.name)) continue;
        queue.push({ name: entry.name.split("/").pop(), get: () => entry.async("arraybuffer") });
      }
    } else if (/\.xlsx$/i.test(f.name)) {
      queue.push({ name: f.name, get: async () => f.buffer });
    } else errors.push(`${f.name}: bukan file .xlsx / .zip`);
  }
  let i = 0;
  for (const q of queue) {
    onProgress?.(++i, queue.length, q.name);
    try {
      all.push(...(await parseRmWorkbook(await q.get(), q.name)));
    } catch (e) {
      errors.push(`${q.name}: tidak dapat dibaca (${e?.message || e})`);
    }
  }
  const best = new Map();
  for (const r of all) {
    const b = best.get(r.bulan);
    if (!b || String(r.modified) > String(b.modified)) best.set(r.bulan, r);
  }
  // versi = jumlah file untuk bulan tsb (revisi); yang dipakai = tersimpan paling akhir.
  const versions = (ym) => all.filter((r) => r.bulan === ym).length;
  const reports = [...best.values()]
    .map((r) => ({ ...r, versi: versions(r.bulan) }))
    .sort((a, b) => a.bulan.localeCompare(b.bulan));
  return { reports, errors, files: queue.length };
}

// Pemeriksaan konsistensi sederhana untuk pratinjau.
export function rmChecks(r) {
  const notes = [];
  const sum = (xs) => xs.reduce((s, x) => s + (x.jumlah || 0), 0);
  if (r.rj && r.rj.perPoli.length && r.rj.total != null && sum(r.rj.perPoli) !== r.rj.total) notes.push("Jumlah per poli ≠ total RJ");
  if (r.igd && r.igd.perSpesialis.length && r.igd.total != null && sum(r.igd.perSpesialis) !== r.igd.total) notes.push("Jumlah per spesialisasi ≠ total IGD");
  if (r.ri && r.ri.perRuang.length && r.ri.total != null && sum(r.ri.perRuang) !== r.ri.total) notes.push("Jumlah per ruangan ≠ total RI");
  if (!r.rj) notes.push("Lembar RJ tidak ada");
  if (!r.igd) notes.push("Lembar IGD tidak ada");
  if (!r.ri) notes.push("Lembar RI tidak ada");
  return notes;
}
