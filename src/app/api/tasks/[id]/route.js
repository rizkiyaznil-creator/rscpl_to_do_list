import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  STATUS_LABELS,
  isValidStatus,
  isValidPriority,
  clampProgress,
} from "@/lib/constants";
import { syncStatusProgress, applyChecklistProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

const ownerSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  department: true,
};

const listInclude = {
  owner: { select: ownerSelect },
  creator: { select: ownerSelect },
  checklist: { select: { id: true, done: true } },
  _count: { select: { comments: true } },
};

// Boleh mengubah bila: admin atau pemilik (penanggung jawab) tugas.
// (Hapus tugas: hanya admin — lihat handler DELETE.)
function canModify(session, task) {
  return session.role === ROLES.ADMIN || task.ownerId === session.id;
}

// GET /api/tasks/:id -> detail lengkap (checklist, komentar, riwayat).
export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({
    where: { id: Number(id) },
    include: {
      owner: { select: ownerSelect },
      creator: { select: ownerSelect },
      checklist: { orderBy: [{ order: "asc" }, { id: "asc" }] },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { id: true, name: true, role: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { actor: { select: { id: true, name: true } } },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }

  return Response.json({ task });
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
    include: { _count: { select: { checklist: true } } },
  });
  if (!task) {
    return Response.json({ error: "Tugas tidak ditemukan." }, { status: 404 });
  }
  if (!canModify(session, task)) {
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

  if (typeof body.title === "string" && body.title.trim() && body.title.trim() !== task.title) {
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
  if ("dueDate" in body) {
    if (!body.dueDate) {
      data.dueDate = null;
    } else {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) data.dueDate = d;
    }
    changes.push("tenggat");
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
  if (!hasChecklist) {
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

  return Response.json({ task: updated });
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
