// Nilai konstan & label berbahasa Indonesia yang dipakai di seluruh aplikasi.

export const ROLES = {
  ADMIN: "ADMIN",
  STAFF: "STAFF",
};

export const ROLE_LABELS = {
  ADMIN: "Admin",
  STAFF: "Personel",
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
