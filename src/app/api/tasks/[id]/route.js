import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  isValidStatus,
  isValidPriority,
  clampProgress,
} from "@/lib/constants";
import { syncStatusProgress } from "@/lib/tasks";

const ownerSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  department: true,
};

// Boleh mengubah/menghapus bila: admin, pemilik tugas, atau pembuat tugas.
function canModify(session, task) {
  return (
    session.role === ROLES.ADMIN ||
    task.ownerId === session.id ||
    task.creatorId === session.id
  );
}

// PATCH /api/tasks/:id  -> ubah status, progress, atau detail lain.
export async function PATCH(request, { params }) {
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

  if (typeof body.title === "string" && body.title.trim()) {
    data.title = body.title.trim();
  }
  if (typeof body.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (isValidPriority(body.priority)) {
    data.priority = body.priority;
  }
  if ("dueDate" in body) {
    if (!body.dueDate) {
      data.dueDate = null;
    } else {
      const d = new Date(body.dueDate);
      if (!Number.isNaN(d.getTime())) data.dueDate = d;
    }
  }

  // Admin boleh memindahkan kepemilikan tugas.
  if (session.role === ROLES.ADMIN && body.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: Number(body.ownerId) } });
    if (!owner) {
      return Response.json({ error: "Personel tujuan tidak ditemukan." }, { status: 400 });
    }
    data.ownerId = owner.id;
  }

  // Tentukan status & progress final lalu selaraskan.
  let nextStatus = isValidStatus(body.status) ? body.status : task.status;
  let nextProgress =
    body.progress === undefined ? task.progress : clampProgress(body.progress);

  // Bila hanya status yang dikirim & berubah ke DONE/TODO, sesuaikan progress.
  if (isValidStatus(body.status) && body.progress === undefined) {
    if (body.status === "DONE") nextProgress = 100;
    if (body.status === "TODO" && task.status === "DONE") nextProgress = 0;
  }

  const synced = syncStatusProgress(nextStatus, nextProgress);
  data.status = synced.status;
  data.progress = synced.progress;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data,
    include: {
      owner: { select: ownerSelect },
      creator: { select: ownerSelect },
    },
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
  if (!canModify(session, task)) {
    return Response.json(
      { error: "Anda tidak berhak menghapus tugas ini." },
      { status: 403 },
    );
  }

  await prisma.task.delete({ where: { id: taskId } });
  return Response.json({ ok: true });
}
