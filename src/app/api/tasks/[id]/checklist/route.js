import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { applyChecklistProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { loadTaskAccess } from "@/lib/taskAccess";
import { taskPerms } from "@/lib/taskPerms";

// POST /api/tasks/:id/checklist -> tambah langkah baru.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const taskId = Number(id);
  const acc = await loadTaskAccess(session, taskId);
  if (acc.error) return Response.json({ error: acc.error }, { status: acc.status });
  const { task } = acc;
  if (!taskPerms(task, session, acc.assignable).checklist) {
    return Response.json({ error: "Anda tidak berhak mengubah tugas ini." }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const text = (body?.text || "").trim();
  if (!text) {
    return Response.json({ error: "Teks langkah wajib diisi." }, { status: 400 });
  }

  // Bagian anggota (tugas bersama): PIC atau anggota tim yang sudah menerima.
  let assigneeId = null;
  if (body?.assigneeId) {
    assigneeId = Number(body.assigneeId);
    const ok =
      assigneeId === task.ownerId ||
      task.members.some((m) => m.userId === assigneeId && m.status === "ACCEPTED");
    if (!ok) return Response.json({ error: "Langkah hanya dapat dibagikan ke PIC atau anggota tim." }, { status: 400 });
  }

  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const item = await prisma.checklistItem.create({
    data: { taskId, text, order: (last?.order ?? 0) + 1, assigneeId },
    include: { assignee: { select: { id: true, name: true } } },
  });

  const result = await applyChecklistProgress(taskId);
  await logActivity({
    taskId,
    actorId: session.id,
    action: "ADD_CHECKLIST",
    detail: `Menambah langkah "${text}"`,
  });

  return Response.json({ item, progress: result }, { status: 201 });
}
