import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { loadOrg, visibleUserIds, approverIds, canSeeAll } from "@/lib/logbook";
import { isValidKey, todayKey, weekStartKey, addDays, keyToDate } from "@/lib/logdate";

// GET /api/logbook/team?week=YYYY-MM-DD
// Ringkasan logbook satu minggu untuk semua personel yang boleh dilihat viewer
// (selain dirinya sendiri): jumlah kegiatan, total jam, status persetujuan.
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("week") || todayKey();
  if (!isValidKey(raw)) {
    return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
  }
  const weekStart = weekStartKey(raw);
  const weekEnd = addDays(weekStart, 6);

  const org = await loadOrg();
  // Akun admin sistem tanpa jabatan tidak ikut direkap (bukan personel SOTK).
  const ids = [...visibleUserIds(org, session.id, session.role)].filter((id) => {
    const u = org.userById.get(id);
    if (id === session.id || u?.status !== USER_STATUS.ACTIVE) return false;
    return !(u.role === ROLES.ADMIN && u.positionId == null);
  });

  const range = { gte: keyToDate(weekStart), lte: keyToDate(weekEnd) };
  const [users, sums, approvals, cats] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        position: { select: { name: true, bidang: true, order: true } },
      },
    }),
    prisma.logEntry.groupBy({
      by: ["userId"],
      where: {
        userId: { in: ids },
        date: range,
      },
      _count: { _all: true },
      _sum: { minutes: true },
    }),
    prisma.logApproval.findMany({
      where: { userId: { in: ids }, weekStart: keyToDate(weekStart) },
      include: { approvedBy: { select: { name: true } } },
    }),
    prisma.logEntry.groupBy({
      by: ["category"],
      where: { userId: { in: ids }, date: range },
      _count: { _all: true },
      _sum: { minutes: true },
    }),
  ]);

  const sumBy = new Map(sums.map((s) => [s.userId, s]));
  const apprBy = new Map(approvals.map((a) => [a.userId, a]));
  const members = users
    .map((u) => ({
      id: u.id,
      name: u.name,
      position: u.position ? { name: u.position.name, bidang: u.position.bidang } : null,
      order: u.position?.order ?? 1e9,
      entries: sumBy.get(u.id)?._count._all ?? 0,
      minutes: sumBy.get(u.id)?._sum.minutes ?? 0,
      approval: apprBy.has(u.id)
        ? {
            approvedAt: apprBy.get(u.id).approvedAt,
            approvedBy: apprBy.get(u.id).approvedBy?.name || null,
          }
        : null,
      canApprove: approverIds(org, u.id).includes(session.id),
    }))
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name))
    .map(({ order, ...m }) => m);

  return Response.json({
    weekStart,
    weekEnd,
    seeAll: canSeeAll(org, session.id, session.role),
    members,
    byCategory: cats
      .map((c) => ({ category: c.category, entries: c._count._all, minutes: c._sum.minutes || 0 }))
      .sort((a, b) => b.minutes - a.minutes),
  });
}
