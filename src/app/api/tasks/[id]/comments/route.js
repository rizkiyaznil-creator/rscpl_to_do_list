import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

const authorSelect = { id: true, name: true, role: true };

// GET /api/tasks/:id/comments -> daftar komentar (urut terlama -> terbaru).
export async function GET(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const comments = await prisma.comment.findMany({
    where: { taskId: Number(id) },
    orderBy: { createdAt: "asc" },
    include: { author: { select: authorSelect } },
  });

  return Response.json({ comments });
}

// POST /api/tasks/:id/comments -> tambah komentar/handover.
// Semua personel yang login boleh berkomentar (papan transparan).
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

  return Response.json({ comment }, { status: 201 });
}
