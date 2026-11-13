import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

// POST /api/tasks/:id/members/respond { accept: boolean, reason? }
// Yang diundang (sesama tingkat / tingkat lebih tinggi) menerima atau menolak
// undangan tugas bersama. Undangan sebagai PIC yang diterima -> menjadi
// pemilik (PIC utama) tugas.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  const { id } = await params;
  const taskId = Number(id);

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const accept = body?.accept === true;
  const reason = String(body?.reason ?? "").trim().slice(0, 1000) || null;
  if (!accept && !reason) {
    return Response.json({ error: "Tuliskan alasan menolak." }, { status: 400 });
  }

  const m = await prisma.taskMember.findUnique({
    where: { taskId_userId: { taskId, userId: session.id } },
    include: { task: { select: { id: true, title: true, ownerId: true, creatorId: true } } },
  });
  if (!m || m.status !== "PENDING") {
    return Response.json({ error: "Tidak ada undangan yang menunggu jawaban Anda." }, { status: 404 });
  }
  const task = m.task;
  const asPic = m.role === "PIC";

  if (accept && asPic) {
    // Menjadi PIC utama: pemilik tugas berpindah; baris undangan dihapus.
    await prisma.$transaction([
      prisma.task.update({ where: { id: taskId }, data: { ownerId: session.id } }),
      prisma.taskMember.delete({ where: { id: m.id } }),
    ]);
  } else {
    await prisma.taskMember.update({
      where: { id: m.id },
      data: { status: accept ? "ACCEPTED" : "DECLINED", reason, respondedAt: new Date() },
    });
  }

  const role = asPic ? "sebagai PIC utama" : "sebagai anggota tim";
  await logActivity({
    taskId,
    actorId: session.id,
    action: accept ? "ACCEPT_INVITE" : "DECLINE_INVITE",
    detail: accept ? `Menerima undangan ${role}` : `Menolak undangan ${role}: ${reason}`,
  });

  // Beri tahu pengundang, pembuat, & PIC (selain diri sendiri).
  const recipients = new Set([m.invitedById, task.creatorId, task.ownerId].filter(Boolean));
  for (const userId of recipients) {
    await notify({
      userId,
      actorId: session.id,
      type: accept ? "SHARED_ACCEPTED" : "SHARED_DECLINED",
      message: accept
        ? `${session.name} menerima undangan ${role} "${task.title}"`
        : `${session.name} menolak undangan ${role} "${task.title}": ${reason}`,
      taskId,
    });
  }
  return Response.json({ ok: true, accepted: accept });
}
