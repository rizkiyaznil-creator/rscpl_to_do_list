import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

// GET /api/activity?limit=  -> riwayat aktivitas terbaru (audit log global).
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 30, 100);

  const activities = await prisma.activity.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      actor: { select: { id: true, name: true } },
      task: { select: { id: true, title: true } },
    },
  });

  return Response.json({ activities });
}
