import { prisma } from "@/lib/prisma";
import { approverIds } from "@/lib/logbook";
import { inviteMode, isSelectable } from "@/lib/taskAccess";
import { notify } from "@/lib/notifications";
import { sendEmail, taskReminderEmail } from "@/lib/email";

// Operasi tim tugas bersama: mengajak anggota/PIC beserta notifikasinya.

async function emailTo(userId, task, kind, message) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!u?.email) return;
  const { subject, html, text } = taskReminderEmail(task, kind, { message });
  await sendEmail({ to: u.email, subject, html, text });
}

// Beri tahu atasan langsung seseorang yang ditambahkan dari luar garis
// komandonya (mis. Wadir I menambahkan Koordinator Keuangan).
async function notifySuperiors({ org, session, assignable, targetId, task }) {
  if (targetId === session.id || assignable.has(targetId)) return;
  const name = org.userById.get(targetId)?.name || "personel";
  for (const sup of approverIds(org, targetId)) {
    if (sup === session.id) continue;
    await notify({
      userId: sup,
      actorId: session.id,
      type: "SHARED_ADDED",
      message: `${session.name} menambahkan ${name} (bawahan Anda) ke tugas bersama "${task.title}"`,
      taskId: task.id,
    });
  }
}

// Undang / tambahkan satu orang. role: "MEMBER" | "PIC" (PIC hanya saat
// calon PIC perlu persetujuan; PIC langsung = owner tugas).
// Mengembalikan "direct" | "approval" | null (dilewati).
export async function addPerson({ org, session, assignable, task, userId, role = "MEMBER" }) {
  if (!isSelectable(org, userId)) return null;
  if (userId === task.ownerId) return null;
  const mode = inviteMode(org, session, userId, assignable);
  const status = mode === "direct" ? "ACCEPTED" : "PENDING";
  const existing = await prisma.taskMember.findUnique({ where: { taskId_userId: { taskId: task.id, userId } } });
  if (existing && existing.status !== "DECLINED") return null; // sudah anggota / sudah diundang
  const data = { role, status, invitedById: session.id, reason: null, respondedAt: status === "ACCEPTED" ? new Date() : null };
  if (existing) await prisma.taskMember.update({ where: { id: existing.id }, data });
  else await prisma.taskMember.create({ data: { ...data, taskId: task.id, userId } });

  const what = role === "PIC" ? "sebagai PIC utama tugas bersama" : "ke tugas bersama";
  if (status === "ACCEPTED") {
    await notify({
      userId,
      actorId: session.id,
      type: "SHARED_ADDED",
      message: `${session.name} menambahkan Anda ${what} "${task.title}"`,
      taskId: task.id,
    });
    if (userId !== session.id) await emailTo(userId, task, "shared", `${session.name} menambahkan Anda ${what}.`);
    await notifySuperiors({ org, session, assignable, targetId: userId, task });
  } else {
    await notify({
      userId,
      actorId: session.id,
      type: "SHARED_INVITE",
      message: `${session.name} mengundang Anda ${what} "${task.title}" — mohon terima atau tolak`,
      taskId: task.id,
    });
    await emailTo(
      userId,
      task,
      "invite",
      `${session.name} mengundang Anda ${what}. Buka tugas untuk menerima atau menolak undangan.`,
    );
  }
  return mode;
}

// Beri tahu atasan PIC lintas bidang (PIC langsung ditetapkan saat membuat).
export { notifySuperiors };
