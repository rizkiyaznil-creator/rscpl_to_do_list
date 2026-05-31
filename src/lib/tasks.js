import { STATUS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

// Jaga konsistensi antara status dan progress:
//  - status DONE        => progress 100
//  - progress >= 100    => status DONE
//  - progress 1-99 dan status masih TODO => IN_PROGRESS
export function syncStatusProgress(status, progress) {
  if (status === STATUS.DONE) return { status, progress: 100 };
  if (progress >= 100) return { status: STATUS.DONE, progress: 100 };
  if (progress > 0 && status === STATUS.TODO) {
    return { status: STATUS.IN_PROGRESS, progress };
  }
  return { status, progress };
}

// Turunkan status sepenuhnya dari nilai progress (dipakai untuk tugas
// yang progress-nya dikendalikan oleh checklist).
export function statusFromProgress(progress) {
  if (progress >= 100) return STATUS.DONE;
  if (progress <= 0) return STATUS.TODO;
  return STATUS.IN_PROGRESS;
}

// Hitung ulang progress & status tugas dari checklist-nya.
// - Bila tugas TIDAK punya item checklist: kembalikan { hasChecklist: false }
//   dan biarkan progress manual apa adanya.
// - Bila punya: progress = (item selesai / total) * 100, status mengikuti.
export async function applyChecklistProgress(taskId) {
  const items = await prisma.checklistItem.findMany({
    where: { taskId },
    select: { done: true },
  });
  if (items.length === 0) {
    return { hasChecklist: false };
  }
  const done = items.filter((i) => i.done).length;
  const progress = Math.round((done / items.length) * 100);
  const status = statusFromProgress(progress);
  await prisma.task.update({
    where: { id: taskId },
    data: { progress, status },
  });
  return { hasChecklist: true, progress, status, done, total: items.length };
}
