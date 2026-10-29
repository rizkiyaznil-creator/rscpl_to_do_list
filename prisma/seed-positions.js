// Mengisi daftar jabatan baku sesuai SOTK (+ kategori logbook & parameter Performa RS) RS Pendidikan Prof. dr. Chairuddin
// P. Lubis USU. Idempotent: HANYA mengisi bila tabel jabatan masih kosong,
// sehingga perubahan yang dibuat admin lewat "Kelola Jabatan" tidak tertimpa.
// Jalankan: node prisma/seed-positions.js  (otomatis saat build Vercel).

const { PrismaClient } = require("@prisma/client");

const BIDANG = {
  DIREKSI: "Direksi",
  MEDIK: "Bidang Medik",
  SDBMR: "Bidang Sumber Daya, Bisnis, dan Mitigasi Risiko",
  AKADEMIK: "Bidang Akademik dan Kerja Sama",
  SPI: "Satuan Pengawas Internal",
  KOMITE: "Komite",
};

// Manajer -> daftar koordinator (default 1 koordinator bernama sama).
const WADIR = [
  {
    key: "w1",
    name: "Wakil Direktur Bidang Medik (Wadir 1)",
    bidang: BIDANG.MEDIK,
    managers: [
      { name: "Pelayanan Medik dan Keperawatan" },
      { name: "Hospitaliti" },
      { name: "Penunjang Medis" },
    ],
  },
  {
    key: "w2",
    name: "Wakil Direktur Bidang Sumber Daya, Bisnis, dan Mitigasi Risiko (Wadir 2)",
    bidang: BIDANG.SDBMR,
    managers: [
      { name: "Keuangan" },
      { name: "Sumber Daya Manusia" },
      { name: "Umum dan Aset" },
    ],
  },
  {
    key: "w3",
    name: "Wakil Direktur Bidang Akademik dan Kerja Sama (Wadir 3)",
    bidang: BIDANG.AKADEMIK,
    managers: [
      { name: "Pendidikan, Pelatihan, dan Penelitian" },
      { name: "Hukum dan Hubungan Masyarakat" },
      { name: "Kerja Sama dan Marketing", koordinator: ["Kerja Sama", "Marketing"] },
    ],
  },
];

const KOMITE = [
  "Komite Medik",
  "Komite Keperawatan",
  "Komite Tenaga Kesehatan Lain",
  "Komite Mutu (PMKP)",
  "Komite Pencegahan dan Pengendalian Infeksi (PPI)",
  "Komite Etik dan Hukum",
  "Komite Keselamatan dan Kesehatan Kerja (K3RS)",
  "Unit Fungsional Pendidikan (UFP)",
  "Komite Etik Penelitian Kesehatan (KEPK)",
  "Komite Pengendalian Resistensi Antimikroba (PPRA)",
];

// Susun daftar datar { key, parent, name, level, bidang, single } berurutan
// (induk selalu muncul sebelum anaknya).
function buildPositions() {
  const list = [];
  const add = (p) => list.push(p);

  add({ key: "dir", name: "Direktur", level: "DIREKTUR", bidang: BIDANG.DIREKSI, single: true });

  for (const w of WADIR) {
    add({ key: w.key, parent: "dir", name: w.name, level: "WADIR", bidang: w.bidang, single: true });
    w.managers.forEach((m, i) => {
      const mKey = `${w.key}m${i}`;
      add({ key: mKey, parent: w.key, name: `Manajer ${m.name}`, level: "MANAJER", bidang: w.bidang, single: true });
      (m.koordinator || [m.name]).forEach((k, j) => {
        const kKey = `${mKey}k${j}`;
        add({ key: kKey, parent: mKey, name: `Koordinator ${k}`, level: "KOORDINATOR", bidang: w.bidang, single: true });
        add({ key: `${kKey}s`, parent: kKey, name: `Staf ${k}`, level: "STAF", bidang: w.bidang, single: false });
      });
    });
  }

  add({ key: "spi", parent: "dir", name: "Kepala Satuan Pengawas Internal", level: "KEPALA", bidang: BIDANG.SPI, single: true });
  add({ key: "spia", parent: "spi", name: "Anggota Satuan Pengawas Internal", level: "ANGGOTA", bidang: BIDANG.SPI, single: false });

  KOMITE.forEach((k, i) => {
    add({ key: `km${i}`, parent: "dir", name: `Ketua ${k}`, level: "KEPALA", bidang: BIDANG.KOMITE, single: true });
    add({ key: `km${i}a`, parent: `km${i}`, name: `Anggota ${k}`, level: "ANGGOTA", bidang: BIDANG.KOMITE, single: false });
  });

  return list;
}

async function seedPositions(prisma) {
  const count = await prisma.position.count();
  if (count > 0) {
    console.log(`Daftar jabatan sudah ada (${count}) — lewati.`);
    return;
  }
  const idByKey = {};
  const list = buildPositions();
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const created = await prisma.position.create({
      data: {
        name: p.name,
        level: p.level,
        bidang: p.bidang,
        single: p.single,
        order: i,
        parentId: p.parent ? idByKey[p.parent] : null,
      },
    });
    idByKey[p.key] = created.id;
  }
  console.log(`Daftar jabatan SOTK dibuat: ${list.length} jabatan.`);
}

// Kategori baku logbook (admin dapat menambah/menghapus lewat aplikasi).
const LOG_CATEGORIES = [
  "Pelayanan",
  "Administrasi",
  "Rapat/Koordinasi",
  "Pendidikan & Pelatihan",
  "Penelitian",
];

async function seedLogCategories(prisma) {
  const count = await prisma.logCategory.count();
  if (count > 0) {
    console.log(`Kategori logbook sudah ada (${count}) — lewati.`);
    return;
  }
  await prisma.logCategory.createMany({
    data: LOG_CATEGORIES.map((name, order) => ({ name, order })),
  });
  console.log(`Kategori logbook dibuat: ${LOG_CATEGORIES.length}.`);
}

// Parameter baku Performa RS (admin dapat mengubah/menambah lewat aplikasi).
// [kode, nama, kelompok, frekuensi, jenis, satuan, sumber, targetOp, target, builtin]
const RM = "Rekam Medis (SIMRS)";
const SHRI = "Sensus Harian Rawat Inap (SHRI) · Rekam Medis";
const KM = "Komite Mutu (PMKP)";
const KP = "Komite Mutu (Tim Keselamatan Pasien)";
const PERF_PARAMS = [
  ["rajal", "Kunjungan rawat jalan", "A", "WEEK", "COUNT", "kunjungan", RM],
  ["igd", "Kunjungan IGD", "A", "WEEK", "COUNT", "kunjungan", RM],
  ["ranap_masuk", "Pasien masuk rawat inap", "A", "WEEK", "COUNT", "pasien", RM],
  ["op_elektif", "Operasi elektif", "A", "WEEK", "COUNT", "operasi", "IBP"],
  ["op_emergensi", "Operasi emergensi", "A", "WEEK", "COUNT", "operasi", "IBP"],
  ["persalinan", "Persalinan", "A", "WEEK", "COUNT", "persalinan", "Maternitas"],
  ["lab", "Pemeriksaan laboratorium", "A", "WEEK", "COUNT", "pemeriksaan", "Instalasi Laboratorium"],
  ["rad", "Pemeriksaan radiologi", "A", "WEEK", "COUNT", "pemeriksaan", "Instalasi Radiologi"],
  ["tt", "Tempat tidur (TT) tersedia", "B", "WEEK", "STOCK", "TT", SHRI, null, null, true],
  ["hp", "Jumlah hari perawatan", "B", "WEEK", "COUNT", "hari", SHRI, null, null, true],
  ["ld", "Lama dirawat pasien keluar", "B", "WEEK", "COUNT", "hari", SHRI, null, null, true],
  ["keluar_hidup", "Pasien keluar hidup", "B", "WEEK", "COUNT", "pasien", SHRI, null, null, true],
  ["mati_lt48", "Pasien meninggal < 48 jam", "B", "WEEK", "COUNT", "pasien", SHRI, null, null, true],
  ["mati_ge48", "Pasien meninggal ≥ 48 jam", "B", "WEEK", "COUNT", "pasien", SHRI, null, null, true],
  ["inm_hh", "Kepatuhan kebersihan tangan", "C", "MONTH", "RATIO", "%", KM, "GTE", 85],
  ["inm_apd", "Kepatuhan penggunaan APD", "C", "MONTH", "RATIO", "%", KM, "GTE", 100],
  ["inm_id", "Kepatuhan identifikasi pasien", "C", "MONTH", "RATIO", "%", KM, "GTE", 100],
  ["inm_sc", "Waktu tanggap operasi SC emergensi ≤ 30 menit", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["inm_wtrj", "Waktu tunggu rawat jalan ≤ 60 menit", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["inm_tunda", "Penundaan operasi elektif", "C", "MONTH", "RATIO", "%", KM, "LTE", 5],
  ["inm_visite", "Kepatuhan waktu visite dokter", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["inm_kritis", "Pelaporan hasil kritis laboratorium", "C", "MONTH", "RATIO", "%", KM, "GTE", 100],
  ["inm_fornas", "Kepatuhan penggunaan Formularium Nasional", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["inm_cp", "Kepatuhan terhadap alur klinis (clinical pathway)", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["inm_jatuh", "Kepatuhan upaya pencegahan risiko jatuh", "C", "MONTH", "RATIO", "%", KM, "GTE", 100],
  ["inm_komplain", "Kecepatan waktu tanggap komplain", "C", "MONTH", "RATIO", "%", KM, "GTE", 80],
  ["kepuasan", "Kepuasan pasien (nilai indeks)", "C", "MONTH", "SCORE", "indeks", "Survei kepuasan · Komite Mutu / Humas", "GTE", 76.61],
  ["ktd", "KTD (Kejadian Tidak Diharapkan)", "D", "WEEK", "COUNT", "insiden", KP],
  ["knc", "KNC (Kejadian Nyaris Cedera)", "D", "WEEK", "COUNT", "insiden", KP],
  ["ktc", "KTC (Kejadian Tidak Cedera)", "D", "WEEK", "COUNT", "insiden", KP],
  ["kpc", "KPC (Kondisi Potensial Cedera)", "D", "WEEK", "COUNT", "insiden", KP],
  ["sentinel", "Kejadian sentinel", "D", "WEEK", "COUNT", "insiden", KP],
];

async function seedPerfParams(prisma) {
  const count = await prisma.perfParam.count();
  if (count > 0) {
    console.log(`Parameter performa sudah ada (${count}) — lewati.`);
    return;
  }
  await prisma.perfParam.createMany({
    data: PERF_PARAMS.map(([code, name, group, freq, kind, unit, source, targetOp, target, builtin], order) => ({
      code, name, group, freq, kind, unit, source,
      targetOp: targetOp || null,
      target: target ?? null,
      builtin: Boolean(builtin),
      order,
    })),
  });
  console.log(`Parameter performa dibuat: ${PERF_PARAMS.length}.`);
}

module.exports = { seedPositions, seedLogCategories, seedPerfParams };

if (require.main === module) {
  const prisma = new PrismaClient();
  seedPositions(prisma)
    .then(() => seedLogCategories(prisma))
    .then(() => seedPerfParams(prisma))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
