import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

// DELETE /api/log-categories/:id -> hapus kategori baku (khusus ADMIN).
// Kegiatan lama yang memakai kategori ini tetap menyimpan namanya.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  if (session.role !== ROLES.ADMIN) {
    return Response.json({ error: "Khusus admin." }, { status: 403 });
  }
  const { id } = await params;
  const catId = Number(id);
  if (!Number.isInteger(catId)) {
    return Response.json({ error: "ID tidak valid." }, { status: 400 });
  }
  await prisma.logCategory.deleteMany({ where: { id: catId } });
  return Response.json({ ok: true });
}
