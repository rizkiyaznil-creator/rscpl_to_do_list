import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { visibleScope, inScope } from "@/lib/logbook";

// Komentar hanya untuk yang boleh melihat tugasnya (pemilik, atasan, akses semua).
async function canSeeTask(session, taskId) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { error: "Tugas tidak ditemukan.", status: 404 };
  if (!inScope(await visibleScope(session), task.ownerId)) {
    return { error: "Anda tidak berhak mengakses tugas ini.", status: 403 };
  }
  return { task };
}

const authorSelect = { id: true, name: true, role: true };

// GET /api/tasks/:id/comments -> daftar komentar (urut terlama -> terbaru).
export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const check = await canSeeTask(session, Number(id));
  if (check.error) return Response.json({ error: check.error }, { status: check.status });

  const comments = await prisma.comment.findMany({
    where: { taskId: Number(id) },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });

  return Response.json({ comments });
}

// POST /api/tasks/:id/comments -> tambah komentar/handover.
// Boleh dilakukan siapa pun yang berhak melihat tugas tersebut.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const taskId = Number(id);
  const check = await canSeeTask(session, taskId);
  if (check.error) return Response.json({ error: check.error }, { status: check.status });
  const { task } = check;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const text = (body?.body || "").trim();
  if (!text) {
    return Response.json({ error: "Komentar tidak boleh kosong." }, { status: 400 });
  }

  const comment = await prisma.comment.create({
    data: { taskId, authorId: session.id, body: text },
    include: { author: { select: authorSelect } },
  });

  await logActivity({
    taskId,
    actorId: session.id,
    action: "ADD_COMMENT",
    detail: `Menambah komentar`,
  });

  // Beri tahu pemilik tugas bila komentar berasal dari orang lain.
  await notify({
    userId: task.ownerId,
    actorId: session.id,
    type: "COMMENT",
    message: `${session.name} berkomentar pada "${task.title}"`,
    taskId,
  });

  return Response.json({ comment }, { status: 201 });
}
