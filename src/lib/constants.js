// Nilai konstan & label berbahasa Indonesia yang dipakai di seluruh aplikasi.

export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
  // Petugas input data Performa RS: hanya mengakses menu Performa RS & Akun Saya.
  SUBADMIN: "SUBADMIN",
};

export const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Personel",
  SUBADMIN: "Subadmin Performa",
};

// Boleh menginput / mengimpor data Performa RS.
export function canInputPerforma(role) {
  return role === ROLES.ADMIN || role === ROLES.SUBADMIN;
}

// Status akun. Pendaftaran mandiri => PENDING (belum bisa login) sampai
// diverifikasi admin => ACTIVE.
export const USER_STATUS = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
};

export const USER_STATUS_LABELS = {
  PENDING: "Menunggu verifikasi",
  ACTIVE: "Aktif",
};

export function isValidUserStatus(value) {
  return Object.values(USER_STATUS).includes(value);
}

// Level jabatan dalam SOTK (urut dari tertinggi).
export const POSITION_LEVELS = [
  "DIREKTUR",
  "WADIR",
  "MANAJER",
  "KOORDINATOR",
  "KEPALA",
  "ANGGOTA",
  "STAF",
];

export const POSITION_LEVEL_LABELS = {
  DIREKTUR: "Direktur",
  WADIR: "Wakil Direktur",
  MANAJER: "Manajer",
  KOORDINATOR: "Koordinator",
  KEPALA: "Kepala / Ketua (SPI, Komite)",
  ANGGOTA: "Anggota (SPI, Komite)",
  STAF: "Staf",
};

export function isValidPositionLevel(value) {
  return POSITION_LEVELS.includes(value);
}

// Field jabatan yang disertakan bersama data user di API.
export const POSITION_SELECT = {
  select: { id: true, name: true, level: true, bidang: true },
};

export const STATUS = {
  TODO: "TODO",
  IN_PROGRESS: "IN_PROGRESS",
  DONE: "DONE",
};

export const STATUS_ORDER = [STATUS.TODO, STATUS.IN_PROGRESS, STATUS.DONE];

export const STATUS_LABELS = {
  TODO: "Belum dikerjakan",
  IN_PROGRESS: "Sedang dikerjakan",
  DONE: "Selesai",
};

export const PRIORITY = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
};

export const PRIORITY_ORDER = [PRIORITY.HIGH, PRIORITY.MEDIUM, PRIORITY.LOW];

export const PRIORITY_LABELS = {
  LOW: "Rendah",
  MEDIUM: "Sedang",
  HIGH: "Tinggi",
};

export function isValidStatus(value) {
  return Object.values(STATUS).includes(value);
}

export function isValidPriority(value) {
  return Object.values(PRIORITY).includes(value);
}

export function isValidRole(value) {
  return Object.values(ROLES).includes(value);
}

// Batasi nilai progress ke rentang 0-100 (integer).
export function clampProgress(value) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

// ---------- Performa RS ----------
export const PERF_GROUPS = {
  A: "Volume pelayanan",
  B: "Sensus rawat inap",
  C: "Indikator Nasional Mutu",
  D: "Insiden keselamatan pasien",
  E: "Keuangan",
  F: "SDM & Pendidikan",
};

export const PERF_FREQ_LABELS = { WEEK: "Mingguan", MONTH: "Bulanan" };

export const PERF_KIND_LABELS = {
  COUNT: "Jumlah (dijumlah per periode)",
  STOCK: "Nilai terakhir (mis. jumlah TT)",
  RATIO: "Persentase (pembilang ÷ penyebut)",
  SCORE: "Nilai indeks (rata-rata berbobot responden)",
};
