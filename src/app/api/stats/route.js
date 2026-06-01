import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { STATUS } from "@/lib/constants";

// GET /api/stats -> ringkasan & laporan beban kerja.
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const [tasks, users] = await Promise.all([
    prisma.task.findMany({
      select: {
        status: true,
        progress: true,
        dueDate: true,
        ownerId: true,
        owner: { select: { id: true, name: true, department: true } },
      },
    }),
    prisma.user.findMany({
      select: { id: true, name: true, department: true, role: true },
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

  // Per departemen
  const deptMap = new Map();
  for (const t of tasks) {
    const dept = t.owner?.department || "Tanpa departemen";
    if (!deptMap.has(dept)) deptMap.set(dept, blank());
    tally(deptMap.get(dept), t);
  }
  const byDepartment = [...deptMap.entries()]
    .map(([department, c]) => ({ department, ...c }))
    .sort((a, b) => b.total - a.total);

  // Per personel (sertakan semua user agar yang 0 tugas pun tampil)
  const personMap = new Map();
  for (const u of users) {
    personMap.set(u.id, {
      id: u.id,
      name: u.name,
      department: u.department || "—",
      role: u.role,
      ...blank(),
    });
  }
  for (const t of tasks) {
    if (t.ownerId && personMap.has(t.ownerId)) tally(personMap.get(t.ownerId), t);
  }
  const byPerson = [...personMap.values()].sort((a, b) => b.total - a.total);

  return Response.json({ totals, byDepartment, byPerson });
}
