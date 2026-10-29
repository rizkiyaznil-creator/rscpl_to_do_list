import { prisma } from "@/lib/prisma";
import { STATUS, USER_STATUS } from "@/lib/constants";
import { sendEmail, taskReminderEmail } from "@/lib/email";
import { todayKey, keyToDate, addDays, toKey } from "@/lib/logdate";
import { loadOrg, approverIds } from "@/lib/logbook";

export const dynamic = "force-dynamic";

// Jenis pengingat menurut sisa hari menuju tenggat (kalender WIB).
//   key  = disimpan di TaskReminder (agar tiap jenis hanya terkirim sekali)
//   mail = jenis template di src/lib/email.js
const BY_DAYS = {
  3: { key: "H3", mail: "h3" },
  1: { key: "H1", mail: "h1" },
  0: { key: "H0", mail: "today" },
};
const OVERDUE = { key: "OVERDUE", mail: "overdue" };

// Tugas yang lewat tenggat lebih lama dari ini tidak dikirimi email lagi
// (mencegah banjir email untuk tugas lama saat fitur pertama kali aktif).
const OVERDUE_WINDOW_DAYS = 30;

// GET /api/cron/reminders
// Dipanggil OTOMATIS oleh Vercel Cron sekali sehari pukul 07.00 WIB (vercel.json).
// Untuk setiap tugas yang belum selesai:
//   - H-3, H-1, hari-H  -> email ke penanggung jawab
//   - lewat tenggat     -> SATU email lanjutan ke penanggung jawab, salinan (CC)
//                          ke atasan langsung
// Semua email ditandai penting. Tiap jenis hanya dikirim sekali per tenggat
// (dicatat di TaskReminder); email yang gagal terkirim dicoba lagi besok.
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

  const today = todayKey();
  const [tasks, org] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { not: STATUS.DONE },
        dueDate: {
          gte: keyToDate(addDays(today, -OVERDUE_WINDOW_DAYS)),
          lt: keyToDate(addDays(today, 4)),
        },
      },
      include: {
        owner: { select: { id: true, name: true, email: true, status: true } },
        reminders: { select: { kind: true, dueDate: true } },
      },
    }),
    loadOrg(),
  ]);

  // Email aktif semua user (untuk CC atasan), dimuat sekali.
  const emails = new Map(
    (
      await prisma.user.findMany({
        where: { status: USER_STATUS.ACTIVE, email: { not: null } },
        select: { id: true, email: true },
      })
    ).map((u) => [u.id, u.email.trim()])
  );

  const summary = { H3: 0, H1: 0, H0: 0, OVERDUE: 0 };
  let alreadySent = 0;
  let noRecipient = 0;
  let failed = 0;

  for (const t of tasks) {
    const dueKey = toKey(t.dueDate);
    const days = Math.round((keyToDate(dueKey) - keyToDate(today)) / 86400000);
    const kind = days < 0 ? OVERDUE : BY_DAYS[days];
    if (!kind) continue; // mis. H-2: tidak ada pengingat

    if (t.reminders.some((r) => r.kind === kind.key && toKey(r.dueDate) === dueKey)) {
      alreadySent++;
      continue;
    }

    const ownerEmail = t.owner?.status === USER_STATUS.ACTIVE ? t.owner.email?.trim() : null;
    let to = ownerEmail ? [ownerEmail] : [];
    let cc = [];
    if (kind === OVERDUE) {
      cc = approverIds(org, t.ownerId)
        .map((id) => emails.get(id))
        .filter(Boolean);
      // Penanggung jawab tanpa email: atasan tetap menerima pemberitahuan.
      if (!to.length) [to, cc] = [cc, []];
    }
    if (!to.length) {
      noRecipient++;
      continue;
    }

    const { subject, html, text } = taskReminderEmail(t, kind.mail, {
      ownerName: kind === OVERDUE ? t.owner?.name : undefined,
      daysOverdue: kind === OVERDUE ? -days : undefined,
      cced: cc.length > 0,
    });
    const ok = await sendEmail({ to, cc, subject, html, text, important: true });
    if (!ok) {
      failed++;
      continue;
    }
    await prisma.taskReminder
      .create({ data: { taskId: t.id, kind: kind.key, dueDate: keyToDate(dueKey) } })
      .catch(() => {}); // sudah tercatat oleh panggilan lain yang berjalan bersamaan
    summary[kind.key]++;
  }

  return Response.json({
    ok: true,
    today,
    checked: tasks.length,
    sent: summary,
    alreadySent,
    noRecipient,
    failed,
  });
}
