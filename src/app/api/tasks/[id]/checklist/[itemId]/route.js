import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { applyChecklistProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";

function canModify(session, task) {
  return (
    session.role === ROLES.ADMIN ||
    task.ownerId === session.id ||
    task.creatorId === session.id
  );
}

// Ambil item + tugasnya, sekaligus cek izin. Mengembalikan {error,status} bila gagal.
async function loadAndAuthorize(session, taskId, itemId) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.taskId !== taskId) {
    return { error: "Langkah tidak ditemukan.", status: 404 };
  }
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Tugas tidak ditemukan.", status: 404 };
  if (!canModify(session, task)) {
    return { error: "Anda tidak berhak mengubah tugas ini.", status: 403 };
  }
  return { item, task };
}

// PATCH /api/tasks/:id/checklist/:itemId -> centang/uncentang atau ubah teks.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id, itemId } = await params;
  const taskId = Number(id);
  const auth = await loadAndAuthorize(session, taskId, Number(itemId));
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const data = {};
  if (typeof body.done === "boolean") data.done = body.done;
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim();

  const item = await prisma.checklistItem.update({
    where: { id: Number(itemId) },
    data,
  });

  const result = await applyChecklistProgress(taskId);

  if ("done" in data) {
    await logActivity({
      taskId,
      actorId: session.id,
      action: "TOGGLE_CHECKLIST",
      detail: `${data.done ? "Menyelesaikan" : "Membuka kembali"} langkah "${item.text}"`,
    });
  }

  return Response.json({ item, progress: result });
}

// DELETE /api/tasks/:id/checklist/:itemId
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id, itemId } = await params;
  const taskId = Number(id);
  const auth = await loadAndAuthorize(session, taskId, Number(itemId));
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  await prisma.checklistItem.delete({ where: { id: Number(itemId) } });
  const result = await applyChecklistProgress(taskId);

  await logActivity({
    taskId,
    actorId: session.id,
    action: "DELETE_CHECKLIST",
    detail: `Menghapus langkah "${auth.item.text}"`,
  });

  return Response.json({ ok: true, progress: result });
}
