import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { applyChecklistProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";

function canModify(session, task) {
  return session.role === ROLES.ADMIN || task.ownerId === session.id;
}

// POST /api/tasks/:id/checklist -> tambah langkah baru.
export async function POST(request, { params }) {
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

  const last = await prisma.checklistItem.findFirst({
    where: { taskId },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const item = await prisma.checklistItem.create({
    data: { taskId, text, order: (last?.order ?? 0) + 1 },
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
