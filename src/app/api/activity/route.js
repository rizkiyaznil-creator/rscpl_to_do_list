import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { visibleScope } from "@/lib/logbook";

// GET /api/activity?limit=  -> riwayat aktivitas terbaru, sebatas tugas/personel
// yang boleh dilihat (Admin/Direktur/Kepala SPI: semua).
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);

  const scope = await visibleScope(session);
  const where = scope.ids
    ? {
        OR: [
          { task: { ownerId: { in: scope.ids } } },
          // aktivitas pada tugas yang sudah dihapus: batasi menurut pelakunya
          { taskId: null, actorId: { in: scope.ids } },
        ],
      }
    : {};

  const activities = await prisma.activity.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return Response.json({ activities });
}
