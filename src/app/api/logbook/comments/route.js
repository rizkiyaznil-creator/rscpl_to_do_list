import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadOrg, visibleUserIds, logbookLink } from "@/lib/logbook";
import { isValidKey, weekStartKey, keyToDate, toKey, formatWeekRange } from "@/lib/logdate";
import { notify } from "@/lib/notifications";
import { COMMENT_SELECT, serializeComment, snippet, MAX_COMMENT } from "@/lib/logComments";

// POST /api/logbook/comments { userId, week, entryId?, body }
// Tambah komentar pada logbook seorang personel: per kegiatan (entryId) atau
// per minggu. Boleh ditulis siapa pun yang berhak melihat logbook tsb
// (pemilik, atasan berjenjang, Kepala SPI, Admin), juga setelah minggu terkunci.
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const userId = Number(body?.userId);
  const text = String(body?.body ?? "").trim();
  if (!Number.isInteger(userId)) {
    return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  if (!text) return Response.json({ error: "Komentar tidak boleh kosong." }, { status: 400 });
  if (text.length > MAX_COMMENT) {
    return Response.json({ error: `Komentar maksimal ${MAX_COMMENT} karakter.` }, { status: 400 });
  }

  const org = await loadOrg();
  if (!visibleUserIds(org, session.id, session.role).has(userId)) {
    return Response.json({ error: "Anda tidak berhak mengomentari logbook ini." }, { status: 403 });
  }

  let entryId = null;
  let weekStart;
  if (body?.entryId != null) {
    const entry = await prisma.logEntry.findUnique({
      where: { id: Number(body.entryId) },
      select: { id: true, userId: true, date: true },
    });
    if (!entry || entry.userId !== userId) {
      return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
    }
    entryId = entry.id;
    weekStart = weekStartKey(toKey(entry.date));
  } else {
    if (!isValidKey(body?.week)) {
      return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
    }
    weekStart = weekStartKey(body.week);
  }

  const comment = await prisma.logComment.create({
    data: {
      ownerId: userId,
      authorId: session.id,
      entryId,
      weekStart: keyToDate(weekStart),
      body: text,
    },
    select: COMMENT_SELECT,
  });

  const where = entryId ? "kegiatan" : "logbook";
  const range = formatWeekRange(weekStart);
  if (session.id !== userId) {
    // Atasan / pemeriksa berkomentar -> beri tahu pemilik logbook.
    await notify({
      userId,
      actorId: session.id,
      type: "LOGBOOK_COMMENT",
      message: `${session.name} mengomentari ${where} Anda minggu ${range}: "${snippet(text)}"`,
      link: logbookLink(userId, userId, weekStart),
    });
  } else {
    // Pemilik membalas -> beri tahu yang sudah berkomentar di utas yang sama
    // (atau, bila belum ada, yang berkomentar di minggu tsb).
    const prior = await prisma.logComment.findMany({
      where: { ownerId: userId, weekStart: keyToDate(weekStart), authorId: { not: userId } },
      select: { authorId: true, entryId: true },
    });
    const inThread = prior.filter((c) => c.entryId === entryId);
    const recipients = new Set((inThread.length ? inThread : prior).map((c) => c.authorId).filter(Boolean));
    for (const rid of recipients) {
      await notify({
        userId: rid,
        actorId: session.id,
        type: "LOGBOOK_COMMENT",
        message: `${session.name} membalas komentar pada logbooknya minggu ${range}: "${snippet(text)}"`,
        link: logbookLink(userId, rid, weekStart),
      });
    }
  }

  return Response.json({ comment: serializeComment(comment) }, { status: 201 });
}
