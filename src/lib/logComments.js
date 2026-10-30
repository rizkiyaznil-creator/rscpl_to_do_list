import { toKey } from "@/lib/logdate";

// Helper bersama untuk komentar & pengembalian logbook.

export const MAX_COMMENT = 2000;

export const COMMENT_SELECT = {
  id: true,
  entryId: true,
  weekStart: true,
  body: true,
  kind: true,
  createdAt: true,
  author: { select: { id: true, name: true, position: { select: { name: true } } } },
};

export function serializeComment(c) {
  return { ...c, weekStart: toKey(c.weekStart) };
}

export function serializeRevision(r) {
  return {
    weekStart: toKey(r.weekStart),
    reason: r.reason,
    createdAt: r.createdAt,
    resolvedAt: r.resolvedAt,
    requestedBy: r.requestedBy?.name || null,
  };
}

// Potongan pendek untuk teks notifikasi.
export function snippet(text, max = 80) {
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
