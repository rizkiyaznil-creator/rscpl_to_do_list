// =============================================================================
//  PROFIL RUMAH SAKIT  —  RSP CPL USU
// =============================================================================
//  File ini berisi seluruh konten yang tampil di halaman awal (landing):
//  nama, visi, misi, falsafah, nilai/pilar, dan timeline/milestone.
//  Cukup ubah teks di sini; tampilan & judul aplikasi menyesuaikan otomatis.
//
//  STATUS KONTEN:
//   - Visi, Misi, Moto CAREST : data resmi (dari pihak RS).
//   - Milestone : CONTOH selaras tema, silakan sesuaikan dengan rencana
//     strategis (renstra) RS yang sebenarnya.
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

  // Moto / falsafah utama RS: CAREST (data resmi).
  // `letter` = huruf akronim yang disorot; `label` = istilah Inggris;
  // `labelId` = padanan Indonesia; `desc` = penjelasan resmi.
  moto: {
    name: "CAREST",
    subtitle: "Moto & Nilai Utama RSP CPL USU",
    values: [
      {
        letter: "C",
        label: "Compassion",
        labelId: "Kepedulian",
        desc:
          "Penghormatan kepada hak asasi manusia, etika profesi, prinsip " +
          "nondiskriminasi, serta sikap humanis dan empatik dalam melayani " +
          "pasien, peserta didik, dan seluruh pemangku kepentingan.",
      },
      {
        letter: "A",
        label: "Academic Excellence",
        labelId: "Keunggulan Akademik",
        desc:
          "Penyelenggaraan pelayanan, pendidikan, dan penelitian yang bermutu " +
          "tinggi, berbasis bukti ilmiah, serta berdaya saing pada tingkat " +
          "nasional dan internasional.",
      },
      {
        letter: "R",
        label: "Responsibility",
        labelId: "Tanggung Jawab",
        desc:
          "Profesionalisme, integritas, dan akuntabilitas dalam penyelenggaraan " +
          "pelayanan, pendidikan, dan penelitian, disertai tata kelola yang " +
          "transparan, efisien, dan berkelanjutan.",
      },
      {
        letter: "E",
        label: "Excellence through Innovation",
        labelId: "Keunggulan melalui Inovasi",
        desc:
          "Pengembangan dan penerapan ilmu pengetahuan, teknologi kedokteran, " +
          "serta inovasi digital secara berkelanjutan untuk meningkatkan mutu " +
          "pelayanan, pembelajaran, dan dampak ilmiah.",
      },
      {
        letter: "S",
        label: "Safety First",
        labelId: "Mengutamakan Keselamatan",
        desc:
          "Keselamatan dan kepentingan pasien sebagai prioritas utama dalam " +
          "setiap pengambilan keputusan klinis dan manajerial, dengan budaya " +
          "keselamatan yang melekat pada seluruh proses kerja, termasuk " +
          "keselamatan peserta didik dan tenaga kesehatan.",
      },
      {
        letter: "T",
        label: "Teamwork & Trust",
        labelId: "Kerja Sama dan Kepercayaan",
        desc:
          "Kolaborasi interprofesional yang solid, komunikasi terbuka, serta " +
          "saling percaya antar sejawat, peserta didik, peneliti, dan mitra " +
          "kerja sebagai fondasi Academic Health System.",
      },
    ],
  },

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
