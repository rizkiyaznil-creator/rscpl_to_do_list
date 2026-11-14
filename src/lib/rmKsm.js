// Pemetaan "Sub Spesialis Bedah" (laporan Rekam Medis, tabel Instalasi Bedah Pusat)
// ke KSM operator. Nama KSM disamakan dengan aplikasi Jadwal Operasi agar bagian
// G (Jadwal Operasi) dan H (Rekam Medis) dapat dibandingkan.
// Sub-spesialis yang tidak dikenali tetap ditampilkan dengan namanya sendiri.
const RULES = [
  [/obgyn|obstetri|ginekolog/i, "Obstetri & Ginekologi"],
  [/torax|toraks|thorax|kardiak/i, "Bedah Toraks, Kardiak & Vaskular"],
  [/plastik/i, "Bedah Plastik Rekonstruksi & Estetik"],
  [/saraf|neuro/i, "Bedah Saraf"],
  [/ortho|orto/i, "Orthopaedi & Traumatologi"],
  [/urolog/i, "Urologi"],
  [/mata|ophthal/i, "Mata"],
  [/tht/i, "THT-KL"],
  [/mulut|maksilo/i, "Bedah Mulut & Maksilofasial"],
  [/kulit|dermato/i, "Dermatologi, Venereologi & Estetika"],
  [/anak/i, "Bedah Anak"],
  [/paru/i, "Paru (Bedah Paru)"],
  // Bedah umum & subspesialisnya (digestif, onkologi, vaskular & endovaskular)
  [/digestif|digestive|onkolog|vaskular|endovask|umum/i, "Bedah"],
];

export function ksmOfSub(nama) {
  const n = String(nama || "").trim();
  for (const [re, ksm] of RULES) if (re.test(n)) return ksm;
  return n.replace(/^bedah\s+/i, "Bedah ") || "(tidak diketahui)";
}

// Ringkas sub-spesialis (satu/lebih laporan) menjadi per KSM.
// reports: [{ month, data }] → { rows: [{ ksm, total, perMonth: {ym: n}, subs: [{nama, jumlah}] }], total }
export function opsPerKsm(reports) {
  const map = new Map();
  let total = 0;
  for (const r of reports) {
    for (const s of r.data?.rj?.ibp?.perSub || []) {
      if (!/bedah/i.test(s.nama) || !(s.jumlah > 0)) continue;
      const ksm = ksmOfSub(s.nama.replace(/^bedah\s+/i, ""));
      const row = map.get(ksm) || { ksm, total: 0, perMonth: {}, subs: new Map() };
      row.total += s.jumlah;
      row.perMonth[r.month] = (row.perMonth[r.month] || 0) + s.jumlah;
      const subName = s.nama.replace(/^bedah\s+/i, "");
      row.subs.set(subName, (row.subs.get(subName) || 0) + s.jumlah);
      map.set(ksm, row);
      total += s.jumlah;
    }
  }
  const rows = [...map.values()]
    .map((r) => ({ ...r, subs: [...r.subs].map(([nama, jumlah]) => ({ nama, jumlah })).sort((a, b) => b.jumlah - a.jumlah) }))
    .sort((a, b) => b.total - a.total);
  return { rows, total };
}
