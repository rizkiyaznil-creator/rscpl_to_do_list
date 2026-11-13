import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { visibleScope, assignableUserIds, positionOf } from "@/lib/logbook";

// Akses tugas, termasuk TUGAS BERSAMA lintas bidang (lihat model TaskMember).
//
// Melihat tugas: Admin/Direktur/Kepala SPI (semua), atau bila salah satu
// "subjek" tugas ada dalam cakupan berjenjang viewer — subjek = PIC (owner),
// pembuat, dan anggota yang sudah menerima. Calon anggota yang diundang
// (PENDING) juga dapat melihat tugas tsb untuk memutuskan.
//
// Mengajak anggota: atasan -> tingkat di bawahnya (atau bawahan sendiri)
// langsung masuk; sesama tingkat atau lebih tinggi perlu persetujuan.

// Tingkat jabatan (makin kecil makin tinggi). Kepala SPI/Ketua Komite setara
// Manajer; Anggota SPI/Komite setara Staf.
const LEVEL_RANK = { DIREKTUR: 1, WADIR: 2, MANAJER: 3, KEPALA: 3, KOORDINATOR: 4, STAF: 5, ANGGOTA: 5 };

export function rankOf(org, userId) {
  const p = positionOf(org, userId);
  return p ? LEVEL_RANK[p.level] ?? 9 : 9;
}

// "direct" = langsung masuk, "approval" = perlu persetujuan yang diajak.
export function inviteMode(org, session, targetId, assignable) {
  if (targetId === session.id) return "direct";
  if (session.role === ROLES.ADMIN) return "direct";
  if (assignable.has(targetId)) return "direct";
  return rankOf(org, session.id) < rankOf(org, targetId) ? "direct" : "approval";
}

// Personel yang dapat dipilih sebagai PIC/anggota: aktif, bukan Subadmin,
// dan bukan akun Admin sistem tanpa jabatan.
export function isSelectable(org, userId) {
  const u = org.userById.get(userId);
  if (!u || u.status !== USER_STATUS.ACTIVE || u.role === ROLES.SUBADMIN) return false;
  return !(u.role === ROLES.ADMIN && u.positionId == null);
}

export const MEMBER_SELECT = {
  select: {
    id: true,
    role: true,
    status: true,
    reason: true,
    userId: true,
    user: { select: { id: true, name: true, position: { select: { name: true, bidang: true } } } },
  },
};

// Subjek tugas untuk pengecekan cakupan.
function subjects(task) {
  const ids = [task.ownerId];
  if (task.creatorId != null) ids.push(task.creatorId);
  for (const m of task.members || []) if (m.status === "ACCEPTED") ids.push(m.userId);
  return ids;
}

export function canSeeTask(scope, task, userId) {
  if (scope.ids === null) return true;
  if (subjects(task).some((id) => scope.ids.includes(id))) return true;
  return (task.members || []).some((m) => m.userId === userId && m.status === "PENDING");
}

// Filter Prisma untuk daftar tugas yang boleh dilihat.
export function visibleTaskWhere(scope, userId) {
  if (scope.ids === null) return {};
  return {
    OR: [
      { ownerId: { in: scope.ids } },
      { creatorId: { in: scope.ids } },
      { members: { some: { userId: { in: scope.ids }, status: "ACCEPTED" } } },
      { members: { some: { userId, status: "PENDING" } } },
    ],
  };
}

// Muat tugas + konteks akses. Mengembalikan { error, status } bila gagal.
export async function loadTaskAccess(session, taskId, include = {}) {
  const [task, scope] = await Promise.all([
    prisma.task.findUnique({
      where: { id: Number(taskId) },
      include: { members: { select: { userId: true, status: true, role: true } }, ...include },
    }),
    visibleScope(session),
  ]);
  if (!task) return { error: "Tugas tidak ditemukan.", status: 404 };
  if (!canSeeTask(scope, task, session.id)) {
    return { error: "Anda tidak berhak mengakses tugas ini.", status: 403 };
  }
  const assignable = assignableUserIds(scope.org, session.id, session.role);
  return { task, scope, org: scope.org, assignable };
}

