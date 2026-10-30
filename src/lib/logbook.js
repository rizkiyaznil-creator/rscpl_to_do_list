import { prisma } from "@/lib/prisma";
import { ROLES } from "@/lib/constants";

// Aturan akses berbasis struktur jabatan (SOTK) — dipakai logbook & tugas.
//  - Lihat     : diri sendiri + semua bawahan (berjenjang); rekan setingkat
//                tidak saling melihat. Admin, Direktur, dan Kepala SPI dapat
//                melihat SEMUA logbook & tugas.
//  - Setujui   : atasan langsung (pemegang jabatan atasan terdekat yang terisi).
//  - Ubah minggu yang sudah disetujui: hanya Direktur atau Wadir terkait
//                (Wadir yang membawahi pemilik logbook).

const SPI_BIDANG = "Satuan Pengawas Internal";

// Muat seluruh struktur (jumlahnya kecil) sekali per permintaan.
export async function loadOrg() {
  const [positions, users] = await Promise.all([
    prisma.position.findMany({
      select: { id: true, parentId: true, level: true, bidang: true, name: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true, status: true, positionId: true },
    }),
  ]);
  const pos = new Map(positions.map((p) => [p.id, p]));
  const children = new Map();
  for (const p of positions) {
    if (p.parentId == null) continue;
    if (!children.has(p.parentId)) children.set(p.parentId, []);
    children.get(p.parentId).push(p.id);
  }
  const holders = new Map();
  for (const u of users) {
    if (u.positionId == null) continue;
    if (!holders.has(u.positionId)) holders.set(u.positionId, []);
    holders.get(u.positionId).push(u);
  }
  const userById = new Map(users.map((u) => [u.id, u]));
  return { pos, children, holders, userById, users };
}

// Daftar id jabatan atasan (dari atasan langsung ke atas).
function ancestors(org, positionId) {
  const out = [];
  const seen = new Set();
  let cur = org.pos.get(positionId)?.parentId ?? null;
  while (cur != null && !seen.has(cur)) {
    seen.add(cur);
    out.push(cur);
    cur = org.pos.get(cur)?.parentId ?? null;
  }
  return out;
}

function descendants(org, positionId) {
  const out = new Set();
  const stack = [...(org.children.get(positionId) || [])];
  while (stack.length) {
    const id = stack.pop();
    if (out.has(id)) continue;
    out.add(id);
    stack.push(...(org.children.get(id) || []));
  }
  return out;
}

// Jabatan seorang user (atau null bila belum ditetapkan).
export function positionOf(org, userId) {
  const u = org.userById.get(userId);
  return u?.positionId != null ? org.pos.get(u.positionId) : null;
}
const viewerPosition = positionOf;

export function canSeeAll(org, viewerId, viewerRole) {
  if (viewerRole === ROLES.ADMIN) return true;
  const p = viewerPosition(org, viewerId);
  if (!p) return false;
  return p.level === "DIREKTUR" || (p.level === "KEPALA" && p.bidang === SPI_BIDANG);
}

// Id user yang logbook-nya boleh dilihat viewer (termasuk dirinya sendiri).
export function visibleUserIds(org, viewerId, viewerRole) {
  if (canSeeAll(org, viewerId, viewerRole)) {
    return new Set(org.users.map((u) => u.id));
  }
  const ids = new Set([viewerId]);
  const p = viewerPosition(org, viewerId);
  if (p) {
    const below = descendants(org, p.id);
    for (const u of org.users) {
      if (u.positionId != null && below.has(u.positionId)) ids.add(u.id);
    }
  }
  return ids;
}

// Atasan langsung pemilik logbook: pemegang jabatan atasan terdekat yang terisi.
export function approverIds(org, ownerId) {
  const owner = org.userById.get(ownerId);
  if (owner?.positionId == null) return [];
  for (const pid of ancestors(org, owner.positionId)) {
    const hs = (org.holders.get(pid) || []).filter((u) => u.id !== ownerId);
    if (hs.length) return hs.map((u) => u.id);
  }
  return [];
}

// Boleh mengubah/membatalkan minggu yang sudah disetujui: Direktur, atau
// Wadir yang jabatannya berada di atas jabatan pemilik logbook.
export function canOverride(org, viewerId, ownerId) {
  if (viewerId === ownerId) return false;
  const vp = viewerPosition(org, viewerId);
  if (!vp) return false;
  if (vp.level === "DIREKTUR") return true;
  if (vp.level !== "WADIR") return false;
  const owner = org.userById.get(ownerId);
  if (owner?.positionId == null) return false;
  return ancestors(org, owner.positionId).includes(vp.id);
}

// Cakupan data yang boleh dilihat sebuah sesi, siap dipakai di filter Prisma.
//   ids = null      -> boleh melihat semua
//   ids = [id, ...] -> hanya data milik user-user ini (diri sendiri + bawahan)
export async function visibleScope(session) {
  const org = await loadOrg();
  if (canSeeAll(org, session.id, session.role)) return { org, ids: null };
  return { org, ids: [...visibleUserIds(org, session.id, session.role)] };
}

export function inScope(scope, userId) {
  return scope.ids === null || scope.ids.includes(userId);
}

// Tautan ke logbook minggu tertentu, dari sudut pandang penerima notifikasi.
export function logbookLink(ownerId, recipientId, weekStart) {
  return ownerId === recipientId
    ? `/logbook?week=${weekStart}`
    : `/logbook?tab=team&user=${ownerId}&week=${weekStart}`;
}
