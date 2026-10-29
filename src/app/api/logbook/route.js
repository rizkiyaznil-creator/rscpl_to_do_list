import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { POSITION_SELECT } from "@/lib/constants";
import { loadOrg, visibleUserIds, approverIds, canOverride } from "@/lib/logbook";
import { isValidKey, todayKey, weekStartKey, addDays, keyToDate, toKey } from "@/lib/logdate";
import { parseLogEntryInput, isWeekLocked } from "@/lib/logEntryInput";

const MAX_RANGE_DAYS = 92;

function serializeEntry(e) {
  return { ...e, date: toKey(e.date) };
}

// GET /api/logbook?userId=&from=YYYY-MM-DD&to=YYYY-MM-DD
// Logbook seorang personel dalam rentang tanggal (default: minggu ini, milik sendiri),
// beserta status persetujuan per minggu & hak akses viewer.
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ? Number(searchParams.get("userId")) : session.id;
  const thisWeek = weekStartKey(todayKey());
  const from = searchParams.get("from") || thisWeek;
  const to = searchParams.get("to") || addDays(from, 6);
  if (!Number.isInteger(userId) || !isValidKey(from) || !isValidKey(to) || to < from) {
    return Response.json({ error: "Parameter tidak valid." }, { status: 400 });
  }
  if ((keyToDate(to) - keyToDate(from)) / 86400000 > MAX_RANGE_DAYS) {
    return Response.json({ error: `Rentang maksimal ${MAX_RANGE_DAYS} hari.` }, { status: 400 });
  }

  const org = await loadOrg();
  if (!visibleUserIds(org, session.id, session.role).has(userId)) {
    return Response.json({ error: "Anda tidak berhak melihat logbook ini." }, { status: 403 });
  }

  const [owner, entries, approvals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, position: POSITION_SELECT },
    }),
    prisma.logEntry.findMany({
      where: { userId, date: { gte: keyToDate(from), lte: keyToDate(to) } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { task: { select: { id: true, title: true } } },
    }),
    prisma.logApproval.findMany({
      where: {
        userId,
        weekStart: { gte: keyToDate(weekStartKey(from)), lte: keyToDate(to) },
      },
      include: { approvedBy: { select: { id: true, name: true } } },
    }),
  ]);
  if (!owner) {
    return Response.json({ error: "Personel tidak ditemukan." }, { status: 404 });
  }

  const approvers = approverIds(org, userId);
  return Response.json({
    owner,
    from,
    to,
    entries: entries.map(serializeEntry),
    approvals: approvals.map((a) => ({ ...a, weekStart: toKey(a.weekStart) })),
    perms: {
      isOwner: userId === session.id,
      canApprove: approvers.includes(session.id),
      canOverride: canOverride(org, session.id, userId),
      approverNames: approvers.map((id) => org.userById.get(id)?.name).filter(Boolean),
    },
  });
}

// POST /api/logbook -> tambah kegiatan ke logbook SENDIRI.
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

  const parsed = await parseLogEntryInput(body, session.id);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

  if (await isWeekLocked(session.id, parsed.weekStart)) {
    return Response.json(
      { error: "Logbook minggu ini sudah disetujui atasan dan terkunci." },
      { status: 409 },
    );
  }

  const entry = await prisma.logEntry.create({
    data: { ...parsed.data, userId: session.id },
    include: { task: { select: { id: true, title: true } } },
  });
  return Response.json({ entry: serializeEntry(entry) }, { status: 201 });
}
