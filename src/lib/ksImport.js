// Pembaca Excel tabulasi kerjasama (dipakai di browser). Membaca SEMUA sheet yang
// punya kolom nama mitra/instansi + nomor KS, berdasarkan JUDUL KOLOM (bukan posisi):
//   BANK PKS            : Jenis KS | Tanggal Mulai | Tanggal berakhir | No KS | Nama Mitra KS | Perihal | ...
//   KS 2024/2025/2026   : No. KS | Jenis | INSTANSI | TENTANG | MASA BERLAKU ("dd/mm/yyyy s.d dd/mm/yyyy")
// Baris yang sama di beberapa sheet digabung (nomor dokumen + nama mitra), sheet
// "BANK PKS" diutamakan. Jenis lama (Klinis/Manajerial/M/P/K) dipetakan ke 6 tipe.
import { dupKeys } from "@/lib/kerjasama";

const MONTHS = { jan: 1, januari: 1, feb: 2, februari: 2, mar: 3, maret: 3, apr: 4, april: 4, mei: 5, may: 5, jun: 6, juni: 6, jul: 7, juli: 7, agu: 8, agt: 8, ags: 8, agustus: 8, aug: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, oct: 10, nov: 11, november: 11, des: 12, desember: 12, dec: 12 };
const pad = (n) => String(n).padStart(2, "0");
const norm = (v) => String(v ?? "").replace(/\s+/g, " ").trim();

function cellVal(c) {
  let v = c.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    v = v.result ?? v.text ?? (v.richText ? v.richText.map((t) => t.text).join("") : v.hyperlink ?? null);
  }
  return v;
}

function validKey(y, m, d) {
  if (!(y > 1990 && y < 2200 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
  const key = `${y}-${pad(m)}-${pad(d)}`;
  return new Date(`${key}T00:00:00Z`).toISOString().slice(0, 10) === key ? key : null;
}

// Date / "dd/mm/yyyy" / "d-m-yyyy" / "07 Juli 2021" -> "YYYY-MM-DD" atau null.
export function parseTanggal(v) {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    // Excel menyimpan tanggal tanpa zona; ambil komponen UTC.
    return validKey(v.getUTCFullYear(), v.getUTCMonth() + 1, v.getUTCDate());
  }
  const s = norm(v).toLowerCase();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/);
  if (m) return validKey(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validKey(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})\s+([a-z]+)\.?\s+(\d{4})$/);
  if (m && MONTHS[m[2]]) return validKey(+m[3], MONTHS[m[2]], +m[1]);
  return null;
}

// "15/01/2025 s.d 15/01/2030" / "01 Juni 2021 s/d 01/06/2026" -> [mulai, berakhir]
export function parseMasa(v) {
  let parts = norm(v).split(/\s*(?:s\s*[./]\s*d\.?|sampai(?:\s+dengan)?|hingga|–|—)\s*|\s+-\s+/i).filter(Boolean);
  if (parts.length < 2) {
    // "01/01/2023-31/12/2024" / "18 April 2024-18 April 2026"
    const m = norm(v).match(/^(.+?\d{4})\s*-\s*(\d.+)$/);
    if (m) parts = [m[1], m[2]];
  }
  if (parts.length < 2) return [null, null];
  return [parseTanggal(parts[0]), parseTanggal(parts[1])];
}

const SEUMUR = /seumur\s*hidup|tidak\s+terbatas|tanpa\s+batas|selamanya/i;

// Peta jenis lama -> tipe aplikasi (dapat diubah per baris di pratinjau).
export function mapTipe(jenis, perihal) {
  const toks = norm(jenis).toLowerCase().split(/\s*[/,&]\s*|\s+dan\s+/).filter(Boolean);
  const has = (re) => toks.some((t) => re.test(t));
  const p = norm(perihal).toLowerCase();
  if (has(/penelitian|riset/) || (!toks.length && /penelitian|uji klinis/.test(p))) return "PENELITIAN";
  if (has(/pendidikan|tri ?dharma|^p$/) || (!toks.length && /tri ?dharma|pendidikan|praktik kerja|pkl/.test(p))) return "PENDIDIKAN";
  if (/penyediaan|dropping|pengadaan|suplai|supply|penempatan alat/.test(p)) return "PENYEDIAAN";
  if (has(/klinis|pelayanan|^k$/)) return "PELAYANAN";
  if (has(/manajerial|operasional|kso|^m$/)) return "OPERASIONAL";
  return "LAINNYA";
}

export function guessJenisMitra(nama) {
  const n = norm(nama).toLowerCase();
  if (/^(pt|cv|ud)\b|\bpt\.|persero|\btbk\b|\bpte\b|\bltd\b|\bbank\b/.test(n)) return "BADAN_USAHA";
  if (/universitas|fakultas|\bfk\b|sekolah|stikes|politeknik|poltek|akademi|rumah sakit|\brs[a-z]*\b|dinas|kementerian|kemenkes|bpjs|pemerintah|puskesmas|lembaga|direktorat|balai|dprd|sekretariat|pusat|badan|institut|kabupaten|kota|provinsi|pmi|palang merah|national university|hospital/.test(n)) return "INSTITUSI";
  return "LAINNYA";
}

// Pisahkan "A, B dan C" menjadi beberapa mitra HANYA bila tiap bagian jelas
// nama lembaga (atau ada penanda tripartit); pihak RS sendiri dibuang.
const SELF = /^(rsp\.?\s*cpl\s*usu|rs\.?\s*usu|rsp\s*usu|rumah\s+sakit\s+(usu|universitas\s+sumatera\s+utara)|rs\s+universitas\s+sumatera\s+utara)\.?$|chairuddin\s+p\.?\s*lubis/i;
// Bagian dianggap nama lembaga bila diawali kata lembaga (FK, Fakultas, RS, PT, ...)
// atau singkatan huruf besar (mis. NUS, RSUP) — bukan akhiran badan hukum (TBK, LTD).
const INST_WORD = /^(fk|fakultas|universitas|rs[a-z]*|rumah\s+sakit\s+(?!gigi)|pt\.?|cv|uptd|upt|balai|yayasan|cent(er|re)|national|bank|dinas|stikes|sekolah|politeknik|poltek\w*|akademi|klinik|puskesmas|kementerian|sekretariat|institut)\b/i;
const ACRONYM = /^(?!(TBK|LTD|PTE|INC|CO)\b)[A-Z]{2,}\b/;
const isInst = (p) => INST_WORD.test(p) || ACRONYM.test(p);
function topLevelSplit(s) {
  const out = [];
  let depth = 0;
  let cur = "";
  const words = s.replace(/\s+/g, " ");
  for (let i = 0; i < words.length; i++) {
    const ch = words[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && ch === ",") {
      out.push(cur);
      cur = "";
      continue;
    }
    if (depth === 0 && words.slice(i, i + 5).toLowerCase() === " dan ") {
      out.push(cur);
      cur = "";
      i += 4;
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim().replace(/^dan\s+/i, "")).filter(Boolean);
}
export function splitMitra(nama) {
  let s = norm(nama);
  let tripartit = false;
  const m = s.match(/^tripart\w*\s*\((.*)\)\s*$/i);
  if (m) {
    s = m[1];
    tripartit = true;
  }
  if (/\(\s*tripart\w*\s*\)\s*$/i.test(s)) {
    s = s.replace(/\(\s*tripart\w*\s*\)\s*$/i, "").trim();
    tripartit = true;
  }
  const parts = topLevelSplit(s);
  if (parts.length < 2) return [s];
  const ok = parts.every((p) => SELF.test(p) || isInst(p));
  if (!ok && !tripartit) return [norm(nama)];
  const mitra = parts.filter((p) => !SELF.test(p));
  return mitra.length ? mitra : [norm(nama)];
}

const COLS = {
  jenis: /^jenis/i,
  mulai: /tanggal\s+mulai/i,
  akhir: /tanggal\s+berakhir/i,
  masa: /masa\s+berlaku/i,
  noks: /^no\.?\s*ks|^nomor\s+kerja\s*sama|^no\.?\s+kerja\s*sama/i,
  mitra: /nama\s+mitra|^instansi/i,
  perihal: /perihal|^tentang/i,
  unit: /unit\s+pelaksana/i,
  picRs: /pic\s+rs/i,
  picMitra: /pic\s+mitra/i,
  rek: /rekening/i,
  ket: /^keterangan/i,
  akr: /terakreditasi/i,
};

function readSheet(ws) {
  // Cari baris judul (dalam 10 baris pertama).
  for (let r = 1; r <= Math.min(10, ws.rowCount); r++) {
    const cols = {};
    ws.getRow(r).eachCell((c, i) => {
      const t = norm(cellVal(c));
      for (const [k, re] of Object.entries(COLS)) if (!cols[k] && re.test(t)) cols[k] = i;
    });
    if (!(cols.mitra && cols.noks)) continue;
    const rows = [];
    for (let rr = r + 1; rr <= ws.rowCount; rr++) {
      const row = ws.getRow(rr);
      const g = (k) => (cols[k] ? cellVal(row.getCell(cols[k])) : null);
      const mitra = norm(g("mitra"));
      if (!mitra || COLS.mitra.test(mitra) || /^instansi$/i.test(mitra)) continue;
      rows.push({ rowNo: rr, get: g });
    }
    return { cols, rows };
  }
  return null;
}

// buffer: ArrayBuffer file .xlsx. today: "YYYY-MM-DD".
// Hasil: { rows: [...], sheets: [{ name, count }] }
export async function parseKsWorkbook(buffer, today) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheets = [...wb.worksheets].sort((a, b) => (/bank/i.test(b.name) ? 1 : 0) - (/bank/i.test(a.name) ? 1 : 0));
  const out = [];
  const seen = new Map(); // dupKey -> index baris pertama
  const info = [];
  for (const ws of sheets) {
    const sheet = readSheet(ws);
    if (!sheet) continue;
    let count = 0;
    for (const { rowNo, get } of sheet.rows) {
      count++;
      const flags = [];
      const namaAsli = norm(get("mitra"));
      const perihal = norm(get("perihal"));
      const jenisAsal = norm(get("jenis"));
      let mulai = parseTanggal(get("mulai"));
      let akhirRaw = get("akhir");
      let berakhir = parseTanggal(akhirRaw);
      if ((!mulai || !berakhir) && get("masa")) {
        const [a, b] = parseMasa(get("masa"));
        mulai = mulai || a;
        if (!berakhir && !SEUMUR.test(norm(akhirRaw))) berakhir = b;
        if (SEUMUR.test(norm(get("masa")))) akhirRaw = get("masa");
      }
      const tanpaBatas = !berakhir;
      if (tanpaBatas) flags.push(SEUMUR.test(norm(akhirRaw)) ? "tanpa tanggal berakhir (seumur hidup)" : "tanggal berakhir tidak ada → tanpa batas");
      let error = null;
      if (!mulai) error = "tanggal mulai tidak terbaca";
      else if (berakhir && berakhir < mulai) error = `tanggal berakhir (${berakhir}) sebelum mulai`;
      const namaMitra = splitMitra(namaAsli);
      if (namaMitra.length > 1) flags.push(`${namaMitra.length} mitra (multipihak)`);
      const nomor = norm(get("noks"));
      const nomorDokumen = /^[-–]+$/.test(nomor) ? "" : nomor;
      const ket = [
        norm(get("ket")),
        get("picRs") ? `PIC RS: ${norm(get("picRs"))}` : "",
        get("rek") ? `Rekening: ${norm(get("rek"))}` : "",
        get("akr") ? `Terakreditasi: ${norm(get("akr"))}` : "",
        `Impor: ${ws.name.trim()} baris ${rowNo}`,
      ].filter(Boolean);
      const item = {
        sheet: ws.name.trim(),
        rowNo,
        jenisAsal,
        tipe: mapTipe(jenisAsal, perihal),
        error,
        flags,
        aktif: !berakhir || berakhir >= today,
        data: {
          tipe: null,
          bidang: perihal.slice(0, 200),
          mulai,
          berakhir: berakhir || null,
          tanpaBatas,
          evalBulan: null,
          isi: perihal,
          nomorDokumen,
          linkDokumen: "",
          unitPelaksana: norm(get("unit")),
          keterangan: ket.join(" · "),
        },
        mitra: namaMitra.map((nama, i) => ({
          nama,
          jenis: guessJenisMitra(nama),
          pimpinan: "",
          kontakPic: i === 0 ? norm(get("picMitra")) : "",
        })),
      };
      // Gabungkan baris yang sama di sheet lain.
      const keys = nomorDokumen ? dupKeys(nomorDokumen, item.mitra[0].nama) : [`${item.mitra[0].nama.toLowerCase().slice(0, 20)}|${mulai}`];
      const dupOf = keys.map((k) => seen.get(k)).find((x) => x != null);
      if (dupOf != null) {
        out[dupOf].alsoIn = [...(out[dupOf].alsoIn || []), `${item.sheet} baris ${rowNo}`];
        continue;
      }
      keys.forEach((k) => seen.set(k, out.length));
      out.push(item);
    }
    info.push({ name: ws.name.trim(), count });
  }
  return { rows: out, sheets: info };
}

// Bentuk yang dikirim ke /api/kerjasama/impor.
export function toPayload(r) {
  return { data: { ...r.data, tipe: r.tipe }, mitra: r.mitra, jenisAsal: r.jenisAsal || null };
}
