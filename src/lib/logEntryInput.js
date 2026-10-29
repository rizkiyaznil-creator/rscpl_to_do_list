import { prisma } from "@/lib/prisma";
import {
  isValidKey,
  todayKey,
  durationMinutes,
  isHttpUrl,
  keyToDate,
  weekStartKey,
} from "@/lib/logdate";

// Validasi & normalisasi isian kegiatan logbook.
// Mengembalikan { data } (siap disimpan) atau { error }.
export async function parseLogEntryInput(body, ownerId) {
  const date = body?.date;
  if (!isValidKey(date)) return { error: "Tanggal tidak valid." };
  if (date > todayKey()) {
    return { error: "Logbook hanya untuk kegiatan yang sudah dilakukan (tanggal tidak boleh di masa depan)." };
  }

  const startTime = body?.startTime || "";
  const endTime = body?.endTime || "";
  const minutes = durationMinutes(startTime, endTime);
  if (minutes === null) {
    return { error: "Jam mulai/selesai tidak valid (format JJ:MM, dan tidak boleh sama)." };
  }

  const category = (body?.category || "").trim();
  if (!category) return { error: "Kategori wajib diisi." };
  if (category.length > 60) return { error: "Kategori maksimal 60 karakter." };

  const description = (body?.description || "").trim();
  if (!description) return { error: "Uraian kegiatan wajib diisi." };

  const output = (body?.output || "").trim() || null;

  const evidenceUrl = (body?.evidenceUrl || "").trim() || null;
  if (evidenceUrl && !isHttpUrl(evidenceUrl)) {
    return { error: "Link bukti harus berupa alamat web (diawali http:// atau https://)." };
  }

  let taskId = null;
  if (body?.taskId) {
    taskId = Number(body.taskId);
    const task = Number.isInteger(taskId)
      ? await prisma.task.findUnique({ where: { id: taskId }, select: { ownerId: true } })
      : null;
    if (!task || task.ownerId !== ownerId) {
      return { error: "Tugas yang ditautkan harus tugas milik Anda sendiri." };
    }
  }

  return {
    data: {
      date: keyToDate(date),
      startTime,
      endTime,
      minutes,
      category,
      description,
      output,
      evidenceUrl,
      taskId,
    },
    weekStart: weekStartKey(date),
  };
}

// Apakah minggu tersebut milik `userId` sudah disetujui (terkunci)?
export async function isWeekLocked(userId, weekStart) {
  const a = await prisma.logApproval.findUnique({
    where: { userId_weekStart: { userId, weekStart: keyToDate(weekStart) } },
    select: { id: true },
  });
  return Boolean(a);
}
