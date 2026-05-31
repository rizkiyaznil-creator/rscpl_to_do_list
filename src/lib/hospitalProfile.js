// =============================================================================
//  PROFIL RUMAH SAKIT  —  SILAKAN EDIT TEKS DI BAWAH SESUAI RS ANDA
// =============================================================================
//  File ini berisi seluruh konten yang tampil di halaman awal (landing):
//  nama, visi, misi, falsafah, nilai, dan timeline/milestone.
//  Cukup ubah teks di sini; tampilan akan otomatis menyesuaikan.
// =============================================================================

export const hospital = {
  name: "RSCPL",
  fullName: "Rumah Sakit RSCPL",
  tagline: "Pelayanan kesehatan paripurna yang aman, bermutu, dan penuh empati.",

  visi:
    "Menjadi rumah sakit rujukan pilihan utama masyarakat yang unggul dalam " +
    "mutu pelayanan, pendidikan, dan keselamatan pasien pada tahun 2030.",

  misi: [
    "Memberikan pelayanan kesehatan yang bermutu, aman, dan terjangkau bagi seluruh lapisan masyarakat.",
    "Mengembangkan sumber daya manusia yang profesional, kompeten, dan berintegritas.",
    "Menerapkan tata kelola rumah sakit yang baik, transparan, dan akuntabel.",
    "Memanfaatkan teknologi informasi kesehatan untuk pelayanan yang efektif dan efisien.",
    "Membangun budaya keselamatan pasien di seluruh unit pelayanan.",
  ],

  // Falsafah utama RS
  falsafah:
    "Kesembuhan dan keselamatan pasien adalah tujuan tertinggi kami. " +
    "Kami melayani dengan hati, dilandasi profesionalisme, kasih sayang, " +
    "dan penghormatan terhadap martabat setiap insan.",

  // Nilai-nilai inti (motto)
  nilai: [
    { kode: "C", label: "Care", desc: "Melayani dengan empati dan sepenuh hati." },
    { kode: "P", label: "Professional", desc: "Bekerja sesuai standar & kompetensi terbaik." },
    { kode: "L", label: "Loyal", desc: "Berdedikasi pada pasien dan institusi." },
  ],

  // Timeline / milestone yang akan dicapai.
  // status: "done" (tercapai) | "ongoing" (berjalan) | "planned" (rencana)
  milestones: [
    {
      year: "2024",
      title: "Akreditasi Paripurna",
      description: "Meraih akreditasi RS tingkat paripurna dari LARS/KARS.",
      status: "done",
    },
    {
      year: "2025",
      title: "Digitalisasi Rekam Medis",
      description: "Implementasi rekam medis elektronik (RME) terintegrasi.",
      status: "done",
    },
    {
      year: "2026",
      title: "Manajemen Tugas Digital",
      description: "Penerapan sistem to-do list & monitoring kinerja personel.",
      status: "ongoing",
    },
    {
      year: "2027",
      title: "Pengembangan Layanan Unggulan",
      description: "Pembukaan pusat layanan jantung & onkologi terpadu.",
      status: "planned",
    },
    {
      year: "2030",
      title: "RS Rujukan Regional",
      description: "Menjadi rujukan utama tingkat regional dengan standar internasional.",
      status: "planned",
    },
  ],
};

export const MILESTONE_STATUS = {
  done: { label: "Tercapai", className: "ms-done" },
  ongoing: { label: "Berjalan", className: "ms-ongoing" },
  planned: { label: "Rencana", className: "ms-planned" },
};
