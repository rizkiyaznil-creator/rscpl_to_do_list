import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { USER_STATUS } from "@/lib/constants";
import { approverIds } from "@/lib/logbook";
import { loadTaskAccess } from "@/lib/taskAccess";
import { taskPerms } from "@/lib/taskPerms";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { sendEmail, taskReminderEmail } from "@/lib/email";
import { isValidKey, todayKey, toKey, keyToDate, formatDayKey } from "@/lib/logdate";

const MAX_REASON = 1000;
const dayLabel = (d) => (d ? formatDayKey(toKey(d), false) : "tanpa tenggat");

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Muat tugas + konteks hak akses; null bila tidak ditemukan / tak terlihat.
async function load(session, id) {
  const acc = await loadTaskAccess(session, id);
  if (acc.error) return null;
  return { task: acc.task, org: acc.org, perms: taskPerms(acc.task, session, acc.assignable) };
}

// POST /api/tasks/:id/extension { dueDate: "YYYY-MM-DD", reason }
// Penanggung jawab tugas dari atasan mengajukan tenggat baru.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  const { id } = await params;
  const ctx = await load(session, id);
  if (!ctx) return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  const { task, org, perms } = ctx;
  if (!perms.extend) {
    return Response.json(
      { error: "Perpanjangan hanya dapat diajukan penanggung jawab untuk tugas dari atasan yang belum selesai." },
      { status: 403 },
    );
  }

  const body = await readBody(request);
  const due = body?.dueDate;
  const reason = String(body?.reason ?? "").trim();
  if (!isValidKey(due)) return Response.json({ error: "Tanggal tenggat baru tidak valid." }, { status: 400 });
  if (due < todayKey()) return Response.json({ error: "Tenggat baru tidak boleh sebelum hari ini." }, { status: 400 });
  if (task.dueDate && toKey(task.dueDate) === due) {
    return Response.json({ error: "Tenggat baru sama dengan tenggat sekarang." }, { status: 400 });
  }
  if (!reason) return Response.json({ error: "Tuliskan alasan perpanjangan." }, { status: 400 });
  if (reason.length > MAX_REASON) {
    return Response.json({ error: `Alasan maksimal ${MAX_REASON} karakter.` }, { status: 400 });
  }
  const pending = await prisma.taskExtension.findFirst({ where: { taskId: task.id, status: "PENDING" } });
  if (pending) {
    return Response.json({ error: "Masih ada pengajuan perpanjangan yang menunggu keputusan." }, { status: 409 });
  }

  const ext = await prisma.taskExtension.create({
    data: { taskId: task.id, previousDue: task.dueDate, requestedDue: keyToDate(due), reason, requestedById: session.id },
  });
  await logActivity({
    taskId: task.id,
    actorId: session.id,
    action: "REQUEST_EXTENSION",
    detail: `Mengajukan perpanjangan tenggat dari ${dayLabel(task.dueDate)} ke ${dayLabel(ext.requestedDue)}`,
  });

  // Penerima: pemberi tugas; bila tidak ada/nonaktif -> atasan langsung.
  const creator = task.creatorId != null ? org.userById.get(task.creatorId) : null;
  const recipientIds =
    creator && creator.status === USER_STATUS.ACTIVE ? [creator.id] : approverIds(org, task.ownerId);
  const users = await prisma.user.findMany({
    where: { id: { in: recipientIds } },
    select: { id: true, email: true },
  });
  const message = `${session.name} mengajukan perpanjangan tenggat dari ${dayLabel(task.dueDate)} ke ${dayLabel(ext.requestedDue)}.\nAlasan: ${reason}`;
  for (const u of users) {
    await notify({
      userId: u.id,
      actorId: session.id,
      type: "EXTENSION_REQUEST",
      message: `${session.name} mengajukan perpanjangan "${task.title}" ke ${dayLabel(ext.requestedDue)}`,
      taskId: task.id,
    });
    if (u.email) {
      const { subject, html, text } = taskReminderEmail(task, "extension", { ownerName: session.name, message });
      await sendEmail({ to: u.email, subject, html, text });
    }
  }

  return Response.json({ ok: true, extension: ext }, { status: 201 });
}

// PATCH /api/tasks/:id/extension { decision: "APPROVE" | "REJECT", note? }
// Pemberi tugas / atasan berjenjang / Admin memutuskan pengajuan yang menunggu.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  const { id } = await params;
  const ctx = await load(session, id);
  if (!ctx) return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  const { task, perms } = ctx;
  if (!perms.manage) {
    return Response.json({ error: "Hanya pemberi tugas atau atasan yang dapat memutuskan." }, { status: 403 });
  }

  const body = await readBody(request);
  const decision = body?.decision;
  if (decision !== "APPROVE" && decision !== "REJECT") {
    return Response.json({ error: "Keputusan tidak valid." }, { status: 400 });
  }
  const note = String(body?.note ?? "").trim().slice(0, MAX_REASON) || null;
  const ext = await prisma.taskExtension.findFirst({ where: { taskId: task.id, status: "PENDING" } });
  if (!ext) return Response.json({ error: "Tidak ada pengajuan yang menunggu." }, { status: 404 });

  const approved = decision === "APPROVE";
  await prisma.$transaction([
    prisma.taskExtension.update({
      where: { id: ext.id },
      data: { status: approved ? "APPROVED" : "REJECTED", note, decidedById: session.id, decidedAt: new Date() },
    }),
    ...(approved ? [prisma.task.update({ where: { id: task.id }, data: { dueDate: ext.requestedDue } })] : []),
  ]);

  const detail = approved
    ? `Menyetujui perpanjangan: tenggat ${dayLabel(task.dueDate)} → ${dayLabel(ext.requestedDue)}`
    : `Menolak perpanjangan ke ${dayLabel(ext.requestedDue)}`;
  await logActivity({
    taskId: task.id,
    actorId: session.id,
    action: approved ? "APPROVE_EXTENSION" : "REJECT_EXTENSION",
    detail: note ? `${detail} · ${note}` : detail,
  });

  if (ext.requestedById) {
    await notify({
      userId: ext.requestedById,
      actorId: session.id,
      type: approved ? "EXTENSION_APPROVED" : "EXTENSION_REJECTED",
      message: approved
        ? `${session.name} menyetujui perpanjangan "${task.title}" — tenggat baru ${dayLabel(ext.requestedDue)}`
        : `${session.name} menolak perpanjangan "${task.title}"${note ? `: ${note}` : ""}`,
      taskId: task.id,
    });
  }

  return Response.json({ ok: true, approved });
}
