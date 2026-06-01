import { prisma } from "@/lib/prisma";

// Catat satu baris aktivitas (audit log). Sengaja "best-effort":
// kegagalan pencatatan tidak boleh menggagalkan operasi utama.
export async function logActivity({ taskId = null, actorId = null, action, detail = null }) {
  try {
    await prisma.activity.create({
      data: { taskId, actorId, action, detail },
    });
  } catch (e) {
    console.error("Gagal mencatat aktivitas:", e?.message || e);
  }
}
