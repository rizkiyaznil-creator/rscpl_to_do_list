// =============================================================================
//  PROFIL RUMAH SAKIT  —  RSP CPL USU
// =============================================================================
//  File ini berisi seluruh konten yang tampil di halaman awal (landing):
//  nama, visi, misi, falsafah, nilai/pilar, dan timeline/milestone.
//  Cukup ubah teks di sini; tampilan & judul aplikasi menyesuaikan otomatis.
//
//  STATUS KONTEN:
//   - Visi & Misi  : data resmi (dari pihak RS).
//   - Falsafah, Pilar, Milestone : CONTOH selaras tema, silakan sesuaikan
//     dengan dokumen resmi / rencana strategis RS.
// =============================================================================

export const hospital = {
  name: "RSP CPL USU",
  fullName: "Rumah Sakit Pendidikan CPL USU",
  tagline:
    "Smart Academic Health Centre yang mengintegrasikan pelayanan, " +
    "pendidikan, dan penelitian untuk kesehatan yang lebih baik.",

  visi:
    "Menjadi Smart Academic Health Centre yang unggul di Asia Tenggara dan " +
    "mengintegrasikan pelayanan, pendidikan, dan penelitian untuk mewujudkan " +
    "kesehatan yang lebih baik bagi seluruh masyarakat.",

  misi: [
    "Memberikan pelayanan klinis yang aman, bermutu tinggi, dan berpusat pada pasien.",
    "Menjadi pusat pendidikan kedokteran dan kesehatan berkelas dunia.",
    "Menghasilkan penelitian translasional yang berdampak nyata.",
    "Membangun sistem kesehatan akademik yang berkelanjutan dan terintegrasi.",
    "Menjadi mitra terpercaya bagi masyarakat, pemerintah, dan komunitas global.",
  ],

  // Falsafah utama RS
  // CATATAN: teks falsafah di bawah masih CONTOH — silakan ganti dengan
  // falsafah resmi RSP CPL USU bila sudah tersedia.
  falsafah:
    "Pelayanan yang aman, bermutu tinggi, dan berpusat pada pasien, " +
    "dilandasi semangat akademik untuk mengintegrasikan pelayanan, " +
    "pendidikan, dan penelitian demi kesehatan yang lebih baik bagi seluruh masyarakat.",

  // Tiga pilar Academic Health Centre (diturunkan langsung dari visi & misi).
  // Ditampilkan di halaman awal sebagai nilai/pilar utama.
  nilai: [
    {
      kode: "PL",
      label: "Pelayanan",
      desc: "Pelayanan klinis yang aman, bermutu tinggi, dan berpusat pada pasien.",
    },
    {
      kode: "PD",
      label: "Pendidikan",
      desc: "Pusat pendidikan kedokteran dan kesehatan berkelas dunia.",
    },
    {
      kode: "PN",
      label: "Penelitian",
      desc: "Penelitian translasional yang berdampak nyata bagi masyarakat.",
    },
  ],

  // Timeline / milestone yang akan dicapai.
  // status: "done" (tercapai) | "ongoing" (berjalan) | "planned" (rencana)
  // CATATAN: tahun & target di bawah masih CONTOH yang diselaraskan dengan
  // visi "Smart Academic Health Centre unggul di Asia Tenggara".
  // Silakan sesuaikan dengan rencana strategis (renstra) RS yang sebenarnya.
  milestones: [
    {
      year: "2024",
      title: "Integrasi Academic Health Centre",
      description:
        "Mengintegrasikan pelayanan, pendidikan, dan penelitian dalam satu ekosistem RS pendidikan.",
      status: "done",
    },
    {
      year: "2025",
      title: "Digitalisasi & Smart Hospital",
      description:
        "Rekam medis elektronik dan sistem informasi terpadu sebagai fondasi Smart Academic Health Centre.",
      status: "done",
    },
    {
      year: "2026",
      title: "Manajemen Kinerja Digital",
      description:
        "Penerapan sistem manajemen tugas & monitoring kinerja personel secara digital.",
      status: "ongoing",
    },
    {
      year: "2028",
      title: "Pusat Pendidikan & Riset Translasional",
      description:
        "Penguatan pendidikan kedokteran berkelas dunia dan penelitian translasional yang berdampak nyata.",
      status: "planned",
    },
    {
      year: "2030",
      title: "Unggul di Asia Tenggara",
      description:
        "Menjadi Smart Academic Health Centre rujukan yang unggul di tingkat Asia Tenggara.",
      status: "planned",
    },
  ],
};

export const MILESTONE_STATUS = {
  done: { label: "Tercapai", className: "ms-done" },
  ongoing: { label: "Berjalan", className: "ms-ongoing" },
  planned: { label: "Rencana", className: "ms-planned" },
};
