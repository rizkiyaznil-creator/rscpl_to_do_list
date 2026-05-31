import { STATUS } from "@/lib/constants";

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
