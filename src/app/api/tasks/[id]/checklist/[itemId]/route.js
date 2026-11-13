import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { applyChecklistProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { loadTaskAccess } from "@/lib/taskAccess";
import { taskPerms } from "@/lib/taskPerms";

// Ambil item + tugasnya, sekaligus cek izin. Mengembalikan {error,status} bila gagal.
//  - full   : PIC, pembuat/atasan, Admin -> ubah teks, bagi, hapus, centang.
//  - toggle : juga anggota tim untuk langkah bagiannya sendiri.
async function loadAndAuthorize(session, taskId, itemId, need) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item || item.taskId !== taskId) {
    return { error: "Langkah tidak ditemukan.", status: 404 };
  }
  const acc = await loadTaskAccess(session, taskId);
  if (acc.error) return acc;
  const perms = taskPerms(acc.task, session, acc.assignable);
  const full = perms.checklist;
  const own = perms.member && item.assigneeId === session.id;
  if (!(full || (need === "toggle" && own))) {
    return { error: "Anda hanya dapat mencentang langkah bagian Anda sendiri.", status: 403 };
  }
  return { item, task: acc.task, full };
}

// PATCH /api/tasks/:id/checklist/:itemId -> centang/uncentang atau ubah teks.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id, itemId } = await params;
  const taskId = Number(id);
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const onlyToggle = Object.keys(body || {}).every((k) => k === "done");
  const auth = await loadAndAuthorize(session, taskId, Number(itemId), onlyToggle ? "toggle" : "full");
  if (auth.error) return Response.json({ error: auth.error }, { status: auth.status });

  const data = {};
  if (typeof body.done === "boolean") data.done = body.done;
  if (typeof body.text === "string" && body.text.trim()) data.text = body.text.trim();
  if ("assigneeId" in body) {
    const aid = body.assigneeId ? Number(body.assigneeId) : null;
    const ok =
      aid === null ||
      aid === auth.task.ownerId ||
      auth.task.members.some((m) => m.userId === aid && m.status === "ACCEPTED");
    if (!ok) return Response.json({ error: "Langkah hanya dapat dibagikan ke PIC atau anggota tim." }, { status: 400 });
    data.assigneeId = aid;
  }

  const item = await prisma.checklistItem.update({
    where: { id: Number(itemId) },
    data,
    include: { assignee: { select: { id: true, name: true } } },
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
  const auth = await loadAndAuthorize(session, taskId, Number(itemId), "full");
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
