import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STATUS } from "@/lib/constants";
import { visibleScope } from "@/lib/logbook";

// GET /api/stats -> ringkasan & laporan beban kerja, sebatas data yang boleh
// dilihat (diri sendiri + bawahan; Admin/Direktur/Kepala SPI: semua).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const scope = await visibleScope(session);
  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      where: scope.ids ? { ownerId: { in: scope.ids } } : {},
      select: {
        status: true,
        progress: true,
        dueDate: true,
        ownerId: true,
        owner: { select: { id: true, position: { select: { bidang: true } } } },
      },
    }),
    prisma.user.findMany({
      where: scope.ids ? { id: { in: scope.ids } } : {},
      select: {
        id: true,
        name: true,
        role: true,
        position: { select: { name: true, bidang: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isOverdue = (t) =>
    t.status !== STATUS.DONE && t.dueDate && new Date(t.dueDate) < today;

  // Total keseluruhan
  const totals = {
    total: tasks.length,
    todo: 0,
    inProgress: 0,
    done: 0,
    overdue: 0,
  };
  for (const t of tasks) {
    if (t.status === STATUS.TODO) totals.todo++;
    else if (t.status === STATUS.IN_PROGRESS) totals.inProgress++;
    else if (t.status === STATUS.DONE) totals.done++;
    if (isOverdue(t)) totals.overdue++;
  }
  totals.completionRate =
    totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  // Template hitungan kosong
  const blank = () => ({ total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 });
  const tally = (bucket, t) => {
    bucket.total++;
    if (t.status === STATUS.TODO) bucket.todo++;
    else if (t.status === STATUS.IN_PROGRESS) bucket.inProgress++;
    else if (t.status === STATUS.DONE) bucket.done++;
    if (isOverdue(t)) bucket.overdue++;
  };

  // Per bidang (diambil dari jabatan pemilik tugas)
  const bidangMap = new Map();
  for (const t of tasks) {
    const bidang = t.owner?.position?.bidang || "Belum ada jabatan";
    if (!bidangMap.has(bidang)) bidangMap.set(bidang, blank());
    tally(bidangMap.get(bidang), t);
  }
  const byBidang = [...bidangMap.entries()]
    .map(([bidang, c]) => ({ bidang, ...c }))
    .sort((a, b) => b.total - a.total);

  // Per personel (sertakan semua user agar yang 0 tugas pun tampil)
  const personMap = new Map();
  for (const u of users) {
    personMap.set(u.id, {
      id: u.id,
      name: u.name,
      jabatan: u.position?.name || "—",
      bidang: u.position?.bidang || "—",
      role: u.role,
      ...blank(),
    });
  }
  for (const t of tasks) {
    if (t.ownerId && personMap.has(t.ownerId)) tally(personMap.get(t.ownerId), t);
  }
  const byPerson = [...personMap.values()].sort((a, b) => b.total - a.total);

  return Response.json({ totals, byBidang, byPerson });
}
