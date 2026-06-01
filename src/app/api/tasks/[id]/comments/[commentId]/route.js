import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// DELETE /api/tasks/:id/comments/:commentId
// Hanya penulis komentar atau admin yang boleh menghapus.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id, commentId } = await params;
  const comment = await prisma.comment.findUnique({ where: { id: Number(commentId) } });
  if (!comment || comment.taskId !== Number(id)) {
    return Response.json({ error: "Komentar tidak ditemukan." }, { status: 404 });
  }

  const allowed = session.role === ROLES.ADMIN || comment.authorId === session.id;
  if (!allowed) {
    return Response.json(
      { error: "Anda tidak berhak menghapus komentar ini." },
      { status: 403 },
    );
  }

  await prisma.comment.delete({ where: { id: Number(commentId) } });
  return Response.json({ ok: true });
}
