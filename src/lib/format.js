// Helper format yang aman dipakai di komponen client (tanpa dependensi server).

export function initials(name) {
  if (!name) return "?";
  const parts = name.replace(/[^A-Za-zÀ-ſ\s.]/g, "").trim().split(/\s+/);
  const letters = parts
    .filter((p) => p && !p.endsWith("."))
    .slice(0, 2)
    .map((p) => p[0]);
  return (letters.join("") || name[0] || "?").toUpperCase();
}

export function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Format ke YYYY-MM-DD untuk <input type="date">.
export function toDateInput(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Waktu relatif singkat dalam Bahasa Indonesia, mis. "5 mnt lalu".
export function timeAgo(value) {
  if (!value) return "";
  const d = new Date(value);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return formatDate(value);
}

export function isOverdue(dueDate, status) {
  if (!dueDate || status === "DONE") return false;
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}
