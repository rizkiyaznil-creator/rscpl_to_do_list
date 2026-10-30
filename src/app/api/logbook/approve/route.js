import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadOrg, approverIds, canOverride, logbookLink } from "@/lib/logbook";
import { isValidKey, weekStartKey, addDays, keyToDate, formatWeekRange } from "@/lib/logdate";
import { notify } from "@/lib/notifications";

async function readTarget(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { error: "Format permintaan tidak valid." };
  }
  const userId = Number(body?.userId);
  if (!Number.isInteger(userId) || !isValidKey(body?.week)) {
    return { error: "Parameter tidak valid." };
  }
  return { userId, weekStart: weekStartKey(body.week) };
}

// POST /api/logbook/approve { userId, week } -> atasan langsung menyetujui
// logbook satu minggu. Setelah disetujui, minggu tersebut terkunci.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const t = await readTarget(request);
  if (t.error) return Response.json({ error: t.error }, { status: 400 });

  const org = await loadOrg();
  if (!approverIds(org, t.userId).includes(session.id)) {
    return Response.json(
      { error: "Hanya atasan langsung yang dapat menyetujui logbook ini." },
      { status: 403 },
    );
  }

  const count = await prisma.logEntry.count({
    where: {
      userId: t.userId,
      date: { gte: keyToDate(t.weekStart), lte: keyToDate(addDays(t.weekStart, 6)) },
    },
  });
  if (count === 0) {
    return Response.json(
      { error: "Belum ada kegiatan pada minggu ini untuk disetujui." },
      { status: 400 },
    );
  }

  const key = { userId_weekStart: { userId: t.userId, weekStart: keyToDate(t.weekStart) } };
  // Disetujui -> permintaan perbaikan (bila ada) selesai.
  const [approval] = await prisma.$transaction([
    prisma.logApproval.upsert({
      where: key,
      update: {},
      create: {
        userId: t.userId,
        weekStart: keyToDate(t.weekStart),
        approvedById: session.id,
      },
    }),
    prisma.logRevision.deleteMany({
      where: { userId: t.userId, weekStart: keyToDate(t.weekStart) },
    }),
  ]);

  await notify({
    userId: t.userId,
    actorId: session.id,
    type: "LOGBOOK_APPROVED",
    message: `${session.name} menyetujui logbook Anda minggu ${formatWeekRange(t.weekStart)}`,
    link: logbookLink(t.userId, t.userId, t.weekStart),
  });

  return Response.json({ ok: true, approval });
}

// DELETE /api/logbook/approve { userId, week } -> batalkan persetujuan
// (membuka kunci). Hanya Direktur / Wadir terkait.
export async function DELETE(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const t = await readTarget(request);
  if (t.error) return Response.json({ error: t.error }, { status: 400 });

  const org = await loadOrg();
  if (!canOverride(org, session.id, t.userId)) {
    return Response.json(
      { error: "Hanya Direktur/Wadir terkait yang dapat membatalkan persetujuan." },
      { status: 403 },
    );
  }

  await prisma.logApproval.deleteMany({
    where: { userId: t.userId, weekStart: keyToDate(t.weekStart) },
  });
  return Response.json({ ok: true });
}
