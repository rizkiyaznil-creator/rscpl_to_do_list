import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { sendEmail, taskReminderEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// GET /api/cron/reminders
// Dipanggil OTOMATIS oleh Vercel Cron sekali sehari (lihat vercel.json).
// Mengirim email pengingat ke penanggung jawab tugas yang belum selesai dan
// tenggatnya HARI INI (hari-H) atau BESOK (H-1).
export async function GET(request) {
  // Proteksi: bila CRON_SECRET diset, hanya terima panggilan dengan header yang
  // benar (Vercel Cron otomatis mengirim "Authorization: Bearer <CRON_SECRET>").
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return Response.json({ error: "Tidak diizinkan." }, { status: 401 });
    }
  }

  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart.getTime() + 86400000);
  const dayAfterStart = new Date(todayStart.getTime() + 2 * 86400000);

  // Tugas belum selesai dengan tenggat hari ini atau besok.
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: STATUS.DONE },
      dueDate: { gte: todayStart, lt: dayAfterStart },
    },
    include: { owner: { select: { id: true, name: true, email: true } } },
  });

  let sent = 0;
  let skippedNoEmail = 0;
  let failed = 0;
  for (const t of tasks) {
    if (!t.owner?.email) {
      skippedNoEmail++;
      continue;
    }
    const due = new Date(t.dueDate);
    const kind = due < tomorrowStart ? "today" : "h1"; // hari-H vs H-1
    const { subject, html, text } = taskReminderEmail(t, kind);
    const ok = await sendEmail({ to: t.owner.email, subject, html, text });
    if (ok) sent++;
    else failed++;
  }

  return Response.json({
    ok: true,
    totalDue: tasks.length,
    sent,
    skippedNoEmail,
    failed,
  });
}
