// Nilai konstan & label berbahasa Indonesia yang dipakai di seluruh aplikasi.

export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
};

export const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Personel",
};

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
