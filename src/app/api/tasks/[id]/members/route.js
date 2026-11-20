import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadTaskAccess } from "@/lib/taskAccess";
import { taskPerms } from "@/lib/taskPerms";
import { addPerson } from "@/lib/taskTeam";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";

async function authorize(session, id) {
  const acc = await loadTaskAccess(session, id);
  if (acc.error) return acc;
  if (!taskPerms(acc.task, session, acc.assignable).team) {
    return { error: "Hanya PIC, pemberi tugas, atau atasan yang dapat mengatur tim.", status: 403 };
  }
  return acc;
}

// POST /api/tasks/:id/members { userIds: [..] } -> tambah/undang anggota tim.
// Atasan -> tingkat di bawahnya langsung masuk; sesama tingkat / lebih tinggi
// menerima undangan yang harus disetujui.
export async function POST(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  const { id } = await params;
  const acc = await authorize(session, id);
  if (acc.error) return Response.json({ error: acc.error }, { status: acc.status });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }
  const ids = [...new Set((Array.isArray(body?.userIds) ? body.userIds : []).map(Number))].filter(Number.isInteger);
  if (!ids.length) return Response.json({ error: "Pilih personel yang akan diajak." }, { status: 400 });

  const added = [];
  const invited = [];
  for (const userId of ids) {
    const mode = await addPerson({ org: acc.org, session, assignable: acc.assignable, task: acc.task, userId });
    const name = acc.org.userById.get(userId)?.name;
    if (mode === "direct") added.push(name);
    else if (mode === "approval") invited.push(name);
  }
  const parts = [];
  if (added.length) parts.push(`menambahkan ${added.join(", ")}`);
  if (invited.length) parts.push(`mengundang ${invited.join(", ")} (menunggu persetujuan)`);
  if (parts.length) {
    await logActivity({ taskId: acc.task.id, actorId: session.id, action: "TEAM_UPDATE", detail: `Tim: ${parts.join("; ")}` });
  }
  return Response.json({ ok: true, added: added.length, invited: invited.length });
}

// DELETE /api/tasks/:id/members?userId= -> keluarkan anggota / batalkan undangan.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
  const { id } = await params;
  const acc = await authorize(session, id);
  if (acc.error) return Response.json({ error: acc.error }, { status: acc.status });

  const userId = Number(new URL(request.url).searchParams.get("userId"));
  const m = await prisma.taskMember.findUnique({ where: { taskId_userId: { taskId: acc.task.id, userId } } });
  if (!m) return Response.json({ error: "Anggota tidak ditemukan." }, { status: 404 });

  await prisma.$transaction([
    prisma.taskMember.delete({ where: { id: m.id } }),
    // Langkah checklist bagiannya menjadi langkah umum.
    prisma.checklistItem.updateMany({ where: { taskId: acc.task.id, assigneeId: userId }, data: { assigneeId: null } }),
  ]);
  const name = acc.org.userById.get(userId)?.name;
  await logActivity({
    taskId: acc.task.id,
    actorId: session.id,
    action: "TEAM_UPDATE",
    detail: m.status === "PENDING" ? `Membatalkan undangan untuk ${name}` : `Mengeluarkan ${name} dari tim`,
  });
  if (m.status === "ACCEPTED") {
    await notify({
      userId,
      actorId: session.id,
      type: "SHARED_REMOVED",
      message: `${session.name} mengeluarkan Anda dari tugas bersama "${acc.task.title}"`,
      taskId: acc.task.id,
    });
  }
  return Response.json({ ok: true });
}
