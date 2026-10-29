import { prisma } from "@/lib/prisma";
import { STATUS } from "@/lib/constants";
import { todayKey, isWeekday, keyToDate } from "@/lib/logdate";

// Pengingat logbook (live): pada hari kerja Senin–Jumat, ingatkan personel
// yang memegang jabatan bila hari ini belum mengisi logbook. Akun tanpa
// jabatan (mis. akun Administrator sistem) tidak diingatkan.
export async function getLogbookReminder(userId) {
  const today = todayKey();
  if (!isWeekday(today)) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { positionId: true },
  });
  if (!user?.positionId) return null;
  const filled = await prisma.logEntry.count({
    where: { userId, date: keyToDate(today) },
  });
  return filled > 0 ? null : { date: today, label: "Anda belum mengisi logbook hari ini" };
}

// Buat notifikasi tersimpan untuk seorang user. Best-effort: jangan sampai
// kegagalan notifikasi menggagalkan operasi utama. Tidak memberi notifikasi
// kepada diri sendiri (mis. menugaskan tugas ke diri sendiri).
export async function notify({ userId, actorId = null, type, message, taskId = null }) {
  try {
    if (!userId || userId === actorId) return;
    await prisma.notification.create({
      data: { userId, type, message, taskId },
    });
  } catch (e) {
    console.error("Gagal membuat notifikasi:", e?.message || e);
  }
}

// Selisih hari kalender antara `date` dan hari ini (0 = hari ini, <0 = lewat).
export function daysUntil(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

// Hitung pengingat tenggat (live) untuk tugas milik user yang BELUM selesai.
// Mengembalikan array item pengingat dengan tingkat urgensi.
// `withinDays`: ambang "akan jatuh tempo" (default 2 hari ke depan).
export async function getDueReminders(userId, withinDays = 2) {
  const tasks = await prisma.task.findMany({
    where: {
      ownerId: userId,
      status: { not: STATUS.DONE },
      dueDate: { not: null },
    },
    select: { id: true, title: true, dueDate: true },
    orderBy: { dueDate: "asc" },
  });

  const reminders = [];
  for (const t of tasks) {
    const d = daysUntil(t.dueDate);
    if (d > withinDays) continue; // belum mendesak

    let level, label;
    if (d < 0) {
      level = "overdue";
      label = `Lewat tenggat ${Math.abs(d)} hari`;
    } else if (d === 0) {
      level = "today";
      label = "Jatuh tempo hari ini";
    } else if (d === 1) {
      level = "soon";
      label = "Jatuh tempo besok";
    } else {
      level = "soon";
      label = `Jatuh tempo dalam ${d} hari`;
    }

    reminders.push({
      taskId: t.id,
      title: t.title,
      dueDate: t.dueDate,
      days: d,
      level,
      label,
    });
  }
  return reminders;
}
