import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadOrg, approverIds, logbookLink } from "@/lib/logbook";
import { isValidKey, weekStartKey, addDays, keyToDate, formatWeekRange } from "@/lib/logdate";
import { isWeekLocked } from "@/lib/logEntryInput";
import { notify } from "@/lib/notifications";
import { snippet, MAX_COMMENT } from "@/lib/logComments";

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// POST /api/logbook/revision { userId, week, reason }
// Atasan langsung mengembalikan logbook satu minggu untuk diperbaiki
// (alasan wajib). Alasan juga dicatat sebagai komentar minggu tsb.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const body = await readBody(request);
  const userId = Number(body?.userId);
  const reason = String(body?.reason ?? "").trim();
  if (!Number.isInteger(userId) || !isValidKey(body?.week)) {
    return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  if (!reason) {
    return Response.json({ error: "Tuliskan alasan / bagian yang perlu diperbaiki." }, { status: 400 });
  }
  if (reason.length > MAX_COMMENT) {
    return Response.json({ error: `Alasan maksimal ${MAX_COMMENT} karakter.` }, { status: 400 });
  }
  const weekStart = weekStartKey(body.week);

  const org = await loadOrg();
  if (!approverIds(org, userId).includes(session.id)) {
    return Response.json(
      { error: "Hanya atasan langsung yang dapat mengembalikan logbook ini." },
      { status: 403 },
    );
  }
  if (await isWeekLocked(userId, weekStart)) {
    return Response.json(
      { error: "Logbook minggu ini sudah disetujui. Batalkan persetujuan terlebih dahulu." },
      { status: 409 },
    );
  }
  const count = await prisma.logEntry.count({
    where: { userId, date: { gte: keyToDate(weekStart), lte: keyToDate(addDays(weekStart, 6)) } },
  });
  if (count === 0) {
    return Response.json({ error: "Belum ada kegiatan pada minggu ini." }, { status: 400 });
  }

  const key = { userId_weekStart: { userId, weekStart: keyToDate(weekStart) } };
  const data = { reason, requestedById: session.id, createdAt: new Date(), resolvedAt: null };
  await prisma.$transaction([
    prisma.logRevision.upsert({
      where: key,
      update: data,
      create: { ...data, userId, weekStart: keyToDate(weekStart) },
    }),
    prisma.logComment.create({
      data: {
        ownerId: userId,
        authorId: session.id,
        weekStart: keyToDate(weekStart),
        body: reason,
        kind: "REVISION",
      },
    }),
  ]);

  await notify({
    userId,
    actorId: session.id,
    type: "LOGBOOK_REVISION",
    message: `${session.name} mengembalikan logbook Anda minggu ${formatWeekRange(weekStart)} untuk diperbaiki: "${snippet(reason)}"`,
    link: logbookLink(userId, userId, weekStart),
  });

  return Response.json({ ok: true });
}

// PATCH /api/logbook/revision { week } -> pemilik menandai logbook yang
// dikembalikan sudah diperbaiki; atasan langsung diberi tahu.
export async function PATCH(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const body = await readBody(request);
  if (!isValidKey(body?.week)) {
    return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  const weekStart = weekStartKey(body.week);

  const rev = await prisma.logRevision.findUnique({
    where: { userId_weekStart: { userId: session.id, weekStart: keyToDate(weekStart) } },
  });
  if (!rev || rev.resolvedAt) {
    return Response.json({ error: "Tidak ada permintaan perbaikan yang terbuka." }, { status: 400 });
  }
  await prisma.logRevision.update({ where: { id: rev.id }, data: { resolvedAt: new Date() } });

  const org = await loadOrg();
  const recipients = new Set([...approverIds(org, session.id), rev.requestedById].filter(Boolean));
  for (const rid of recipients) {
    await notify({
      userId: rid,
      actorId: session.id,
      type: "LOGBOOK_FIXED",
      message: `${session.name} telah memperbaiki logbook minggu ${formatWeekRange(weekStart)} — mohon diperiksa kembali`,
      link: logbookLink(session.id, rid, weekStart),
    });
  }

  return Response.json({ ok: true });
}
