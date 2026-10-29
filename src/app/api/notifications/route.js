import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getDueReminders, getLogbookReminder } from "@/lib/notifications";

// GET /api/notifications
// Mengembalikan: notifikasi tersimpan (assigned/comment), pengingat tenggat
// live, dan total badge (notifikasi belum dibaca + jumlah pengingat).
export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const [items, unreadCount, reminders, logbook] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.notification.count({ where: { userId: session.id, read: false } }),
    getDueReminders(session.id),
    getLogbookReminder(session.id),
  ]);

  // Badge = notifikasi belum dibaca + pengingat tenggat + pengingat logbook.
  const badge = unreadCount + reminders.length + (logbook ? 1 : 0);

  return Response.json({ items, reminders, logbook, unreadCount, badge });
}

// POST /api/notifications  body: { id } untuk tandai satu, atau { all: true }.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body?.all) {
    await prisma.notification.updateMany({
      where: { userId: session.id, read: false },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  if (body?.id) {
    // updateMany dengan filter userId memastikan user hanya menandai miliknya.
    await prisma.notification.updateMany({
      where: { id: Number(body.id), userId: session.id },
      data: { read: true },
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
}
