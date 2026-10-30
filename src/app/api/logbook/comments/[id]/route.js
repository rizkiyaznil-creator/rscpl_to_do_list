import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// DELETE /api/logbook/comments/:id -> hanya penulis komentar atau Admin.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { id } = await params;
  const comment = await prisma.logComment.findUnique({
    where: { id: Number(id) },
    select: { id: true, authorId: true },
  });
  if (!comment) {
    return Response.json({ error: "Komentar tidak ditemukan." }, { status: 404 });
  }
  if (comment.authorId !== session.id && session.role !== ROLES.ADMIN) {
    return Response.json(
      { error: "Hanya penulis komentar atau Admin yang dapat menghapusnya." },
      { status: 403 },
    );
  }

  await prisma.logComment.delete({ where: { id: comment.id } });
  return Response.json({ ok: true });
}
