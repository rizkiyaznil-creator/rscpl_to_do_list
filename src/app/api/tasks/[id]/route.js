import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  STATUS_LABELS,
  isValidStatus,
  isValidPriority,
  clampProgress,
  POSITION_SELECT,
} from "@/lib/constants";
import { syncStatusProgress, applyChecklistProgress, completedAtFor } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { visibleScope, loadOrg, assignableUserIds } from "@/lib/logbook";
import { canSeeTask, MEMBER_SELECT } from "@/lib/taskAccess";
import { taskPerms, withPerms } from "@/lib/taskPerms";
import { toKey, formatDayKey } from "@/lib/logdate";

const ownerSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  position: POSITION_SELECT,
};

const listInclude = {
  owner: { select: ownerSelect },
  creator: { select: ownerSelect },
  checklist: { select: { id: true, done: true } },
  _count: { select: { comments: true } },
  extensions: { where: { status: "PENDING" }, select: { id: true, requestedDue: true } },
  members: { ...MEMBER_SELECT, where: { status: { not: "DECLINED" } } },
};

const dayLabel = (d) => (d ? formatDayKey(toKey(d), false) : "tanpa tenggat");

// GET /api/tasks/:id -> detail lengkap (checklist, komentar, riwayat).
export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const taskQuery = prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      owner: { select: ownerSelect },
      creator: { select: ownerSelect },
      checklist: {
        orderBy: [{ order: "asc" }, { id: "asc" }],
        include: { assignee: { select: { id: true, name: true } } },
      },
      members: { ...MEMBER_SELECT, orderBy: { createdAt: "asc" } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true } } },
      },
      extensions: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          requestedBy: { select: { id: true, name: true } },
          decidedBy: { select: { id: true, name: true } },
        },
      },
    },
  });
  // Data tugas & cakupan hak lihat diambil bersamaan (tidak saling bergantung).
  const [task, scope] = await Promise.all([taskQuery, visibleScope(session)]);

  if (!task) {
    return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (!canSeeTask(scope, task, session.id)) {
    return Response.json({ error: "Anda tidak berhak melihat tugas ini." }, { status: 403 });
  }

  const assignable = assignableUserIds(scope.org, session.id, session.role);
  return Response.json({ task: withPerms(task, session, assignable) });
}

// PATCH /api/tasks/:id  -> ubah status, progress, atau detail lain.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const taskId = Number(id);
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { _count: { select: { checklist: true } }, members: { select: { userId: true, status: true, role: true } } },
  });
  if (!task) {
    return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  const org = await loadOrg();
  const assignable = assignableUserIds(org, session.id, session.role);
  const perms = taskPerms(task, session, assignable);
  if (!perms.edit) {
    return Response.json(
      { error: "Anda tidak berhak mengubah tugas ini." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const data = {};
  const changes = [];

  // Tenggat baru (bila diminta & benar-benar berbeda).
  let nextDue;
  if ("dueDate" in body) {
    if (!body.dueDate) nextDue = null;
    else {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) nextDue = d;
    }
  }
  const dueChanged =
    nextDue !== undefined && (nextDue ? toKey(nextDue) : null) !== (task.dueDate ? toKey(task.dueDate) : null);
  const titleChanged = typeof body.title === "string" && body.title.trim() && body.title.trim() !== task.title;
  const prioChanged = isValidPriority(body.priority) && body.priority !== task.priority;

  // Tugas dari atasan: judul, prioritas & tenggat hanya boleh diubah pemberi
  // tugas / atasan / Admin. Penanggung jawab mengajukan perpanjangan.
  if (!perms.core && (dueChanged || titleChanged || prioChanged)) {
    return Response.json(
      {
        error:
          "Judul, prioritas, dan tenggat tugas dari atasan hanya dapat diubah oleh pemberi tugas. Gunakan “Ajukan perpanjangan” untuk meminta tenggat baru.",
      },
      { status: 403 },
    );
  }

  if (titleChanged) {
    data.title = body.title.trim();
    changes.push("judul");
  }
  if (typeof body.description === "string") {
    const desc = body.description.trim() || null;
    if (desc !== task.description) {
      data.description = desc;
      changes.push("deskripsi");
    }
  }
  if (isValidPriority(body.priority) && body.priority !== task.priority) {
    data.priority = body.priority;
    changes.push("prioritas");
  }
  let dueDetail = null;
  if (dueChanged) {
    data.dueDate = nextDue;
    dueDetail = `Tenggat diubah dari ${dayLabel(task.dueDate)} ke ${dayLabel(nextDue)}`;
  }

  // Admin boleh memindahkan kepemilikan tugas.
  let movedToName = null;
  if (session.role === ROLES.ADMIN && body.ownerId && Number(body.ownerId) !== task.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: Number(body.ownerId) } });
    if (!owner) {
      return Response.json({ error: "Personel tujuan tidak ditemukan." }, { status: 400 });
    }
    data.ownerId = owner.id;
    movedToName = owner.name;
  }

  const hasChecklist = task._count.checklist > 0;

  // Bila tugas TIDAK punya checklist, status & progress diatur manual.
  // Bila punya checklist, progress dikendalikan checklist (abaikan input manual).
  let statusDetail = null;
  let progressDetail = null;
  if (!hasChecklist && perms.progress) {
    let nextStatus = isValidStatus(body.status) ? body.status : task.status;
    let nextProgress =
      body.progress === undefined ? task.progress : clampProgress(body.progress);

    if (isValidStatus(body.status) && body.progress === undefined) {
      if (body.status === "DONE") nextProgress = 100;
      if (body.status === "TODO" && task.status === "DONE") nextProgress = 0;
    }

    const synced = syncStatusProgress(nextStatus, nextProgress);
    if (synced.status !== task.status) {
      data.status = synced.status;
      const completedAt = completedAtFor(task.status, synced.status);
      if (completedAt !== undefined) data.completedAt = completedAt;
      statusDetail = `Status menjadi "${STATUS_LABELS[synced.status]}"`;
    }
    if (synced.progress !== task.progress) {
      data.progress = synced.progress;
      progressDetail = `Progress menjadi ${synced.progress}%`;
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.task.update({ where: { id: taskId }, data });
  }

  // Jika ada checklist, hitung ulang progress & status dari checklist.
  if (hasChecklist) {
    await applyChecklistProgress(taskId);
  }

  // Tenggat diubah pemberi tugas/atasan -> beri tahu penanggung jawab
  // (dan sebaliknya: perubahan oleh penanggung jawab tugas pribadi tidak perlu).
  if (dueDetail && task.ownerId !== session.id) {
    await notify({
      userId: task.ownerId,
      actorId: session.id,
      type: "DUE_CHANGED",
      message: `${session.name} mengubah tenggat "${task.title}" menjadi ${dayLabel(nextDue)}`,
      taskId,
    });
  }

  // Notifikasi ke pemilik baru bila tugas dialihkan.
  if (data.ownerId) {
    await notify({
      userId: data.ownerId,
      actorId: session.id,
      type: "ASSIGNED",
      message: `${session.name} mengalihkan tugas "${task.title}" kepada Anda`,
      taskId,
    });
  }

  // Susun catatan aktivitas.
  const details = [];
  if (dueDetail) details.push(dueDetail);
  if (statusDetail) details.push(statusDetail);
  if (progressDetail) details.push(progressDetail);
  if (movedToName) details.push(`Dipindahkan ke ${movedToName}`);
  if (changes.length) details.push(`Menyunting ${changes.join(", ")}`);
  if (details.length) {
    await logActivity({
      taskId,
      actorId: session.id,
      action: "UPDATE_TASK",
      detail: details.join(" · "),
    });
  }

  const updated = await prisma.task.findUnique({
    where: { id: taskId },
    include: listInclude,
  });

  return Response.json({ task: withPerms(updated, session, assignable) });
}

// DELETE /api/tasks/:id
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const taskId = Number(id);
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  // Hanya admin yang boleh menghapus tugas (personel tidak dapat menghapus).
  if (session.role !== ROLES.ADMIN) {
    return Response.json(
      { error: "Hanya admin yang dapat menghapus tugas." },
      { status: 403 },
    );
  }

  // Catat dulu sebelum dihapus (taskId akan di-SetNull setelah tugas hilang).
  await logActivity({
    taskId,
    actorId: session.id,
    action: "DELETE_TASK",
    detail: `Menghapus tugas "${task.title}"`,
  });

  await prisma.task.delete({ where: { id: taskId } });
  return Response.json({ ok: true });
}
