// Mengisi daftar jabatan baku sesuai SOTK RS Pendidikan Prof. dr. Chairuddin
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

module.exports = { seedPositions };

if (require.main === module) {
  const prisma = new PrismaClient();
  seedPositions(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
