import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES, STATUS, USER_STATUS } from "@/lib/constants";
import { loadOrg, visibleUserIds, approverIds, canSeeAll, positionOf } from "@/lib/logbook";
import { todayKey, weekStartKey, addDays, keyToDate, toKey, dayIndex } from "@/lib/logdate";

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// GET /api/dashboard -> ringkasan untuk halaman Dashboard (menyesuaikan peran/jabatan).
// Setiap bagian diambil secara PARALEL agar jumlah perjalanan bolak-balik ke
// database sesedikit mungkin.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const me = session.id;
  const today = todayKey();
  const todayDate = keyToDate(today);
  const weekStart = weekStartKey(today);
  const weekEnd = addDays(weekStart, 6);
  const thisWeek = { gte: keyToDate(weekStart), lte: keyToDate(weekEnd) };
  const isLate = (t) => t.status !== STATUS.DONE && t.dueDate && t.dueDate < todayDate;

  const org = await loadOrg();
  const myPos = positionOf(org, me);
  const seeAll = canSeeAll(org, me, session.role);
  const teamIds = [...visibleUserIds(org, me, session.role)].filter((id) => {
    const u = org.userById.get(id);
    if (id === me || u?.status !== USER_STATUS.ACTIVE) return false;
    return !(u.role === ROLES.ADMIN && u.positionId == null); // akun admin sistem
  });

  // ---------- Tugas saya ----------
  async function loadTasks() {
    const myTasks = await prisma.task.findMany({
      where: { ownerId: me },
      select: { id: true, title: true, status: true, priority: true, dueDate: true, progress: true },
    });
    return {
      total: myTasks.length,
      todo: myTasks.filter((t) => t.status === STATUS.TODO).length,
      inProgress: myTasks.filter((t) => t.status === STATUS.IN_PROGRESS).length,
      done: myTasks.filter((t) => t.status === STATUS.DONE).length,
      overdue: myTasks.filter(isLate).length,
      upcoming: myTasks
        .filter((t) => t.status !== STATUS.DONE && t.dueDate)
        .sort((a, b) => a.dueDate - b.dueDate)
        .slice(0, 5)
        .map((t) => ({ ...t, overdue: isLate(t) })),
    };
  }

  // ---------- Logbook saya minggu ini ----------
  async function loadLogbook() {
    const [myEntries, myApproval] = await Promise.all([
      prisma.logEntry.findMany({
        where: { userId: me, date: thisWeek },
        select: { date: true, minutes: true },
      }),
      prisma.logApproval.findUnique({
        where: { userId_weekStart: { userId: me, weekStart: keyToDate(weekStart) } },
        include: { approvedBy: { select: { name: true } } },
      }),
    ]);
    const filled = new Set(myEntries.map((e) => toKey(e.date)));
    const missingDays = [];
    for (let i = 0; i <= Math.min(dayIndex(today), 4); i++) {
      const d = addDays(weekStart, i);
      if (!filled.has(d)) missingDays.push(d);
    }
    return {
      weekStart,
      weekEnd,
      entries: myEntries.length,
      minutes: myEntries.reduce((s, e) => s + e.minutes, 0),
      missingDays,
      filledToday: filled.has(today),
      approval: myApproval
        ? { approvedAt: myApproval.approvedAt, approvedBy: myApproval.approvedBy?.name || null }
        : null,
      approverNames: approverIds(org, me).map((id) => org.userById.get(id)?.name).filter(Boolean),
      hasPosition: Boolean(myPos),
    };
  }

  // ---------- Bawahan / tim ----------
  async function loadTeam() {
    if (teamIds.length === 0) return null;
    const fromWeek = addDays(weekStart, -21); // 4 minggu terakhir
    const approvees = teamIds.filter((id) => approverIds(org, id).includes(me));
    const [recentEntries, approvals, weekSums, lateTasks] = await Promise.all([
      prisma.logEntry.findMany({
        where: { userId: { in: approvees }, date: { gte: keyToDate(fromWeek), lte: keyToDate(weekEnd) } },
        select: { userId: true, date: true },
      }),
      prisma.logApproval.findMany({
        where: { userId: { in: approvees }, weekStart: { gte: keyToDate(fromWeek) } },
        select: { userId: true, weekStart: true },
      }),
      prisma.logEntry.groupBy({
        by: ["userId"],
        where: { userId: { in: teamIds }, date: thisWeek },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: { ownerId: { in: teamIds }, status: { not: STATUS.DONE }, dueDate: { lt: todayDate } },
        select: { id: true, title: true, dueDate: true, ownerId: true },
        orderBy: { dueDate: "asc" },
      }),
    ]);

    // Minggu berisi kegiatan yang belum disetujui (dan saya atasan langsungnya).
    const approved = new Set(approvals.map((a) => `${a.userId}|${toKey(a.weekStart)}`));
    const pendingMap = new Map();
    for (const e of recentEntries) {
      const key = `${e.userId}|${weekStartKey(toKey(e.date))}`;
      if (!approved.has(key)) pendingMap.set(key, (pendingMap.get(key) || 0) + 1);
    }
    const pending = [...pendingMap.entries()]
      .map(([key, entries]) => {
        const [userId, week] = key.split("|");
        return { userId: Number(userId), name: org.userById.get(Number(userId))?.name, week, entries };
      })
      .sort((a, b) => b.week.localeCompare(a.week) || a.name.localeCompare(b.name));

    const filledIds = new Set(weekSums.map((s) => s.userId));
    const notFilled = teamIds
      .filter((id) => org.userById.get(id)?.positionId != null && !filledIds.has(id))
      .map((id) => ({ userId: id, name: org.userById.get(id).name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      size: teamIds.length,
      pendingApproval: pending.length,
      pending: pending.slice(0, 6),
      notFilledCount: notFilled.length,
      notFilled: notFilled.slice(0, 8),
      overdueCount: lateTasks.length,
      overdue: lateTasks.slice(0, 5).map((t) => ({
        id: t.id,
        title: t.title,
        dueDate: t.dueDate,
        ownerName: org.userById.get(t.ownerId)?.name,
      })),
    };
  }

  // ---------- Ringkasan per bidang (Direktur, Wadir, akses semua) ----------
  async function loadBidang() {
    if (!(seeAll || myPos?.level === "DIREKTUR" || myPos?.level === "WADIR")) return null;
    const scoped = await prisma.task.findMany({
      where: seeAll ? {} : { ownerId: { in: [me, ...teamIds] } },
      select: { status: true, dueDate: true, ownerId: true },
    });
    const map = new Map();
    for (const t of scoped) {
      const pid = org.userById.get(t.ownerId)?.positionId;
      const b = (pid != null && org.pos.get(pid)?.bidang) || "Belum ada jabatan";
      const row = map.get(b) || { bidang: b, total: 0, done: 0, overdue: 0 };
      row.total++;
      if (t.status === STATUS.DONE) row.done++;
      if (isLate(t)) row.overdue++;
      map.set(b, row);
    }
    return [...map.values()]
      .map((r) => ({ ...r, pct: pct(r.done, r.total) }))
      .sort((a, b) => b.total - a.total);
  }

  // ---------- Admin ----------
  async function loadRegistrations() {
    if (session.role !== ROLES.ADMIN) return null;
    return prisma.user.count({ where: { status: USER_STATUS.PENDING } });
  }

  const [tasks, logbook, team, bidang, pendingRegistrations] = await Promise.all([
    loadTasks(),
    loadLogbook(),
    loadTeam(),
    loadBidang(),
    loadRegistrations(),
  ]);

  return Response.json({
    today,
    me: { name: session.name, position: myPos ? { name: myPos.name, bidang: myPos.bidang } : null },
    tasks,
    logbook,
    team,
    bidang,
    pendingRegistrations,
  });
}
