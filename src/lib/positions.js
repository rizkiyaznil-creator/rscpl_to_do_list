import { prisma } from "@/lib/prisma";

// Validasi penetapan jabatan untuk seorang user.
// - nilai kosong/null  -> lepas jabatan (positionId = null)
// - jabatan struktural (single) hanya boleh dipegang satu orang
// Mengembalikan { positionId } atau { error, status }.
export async function resolvePositionAssignment(rawPositionId, userId = null) {
  if (rawPositionId === null || rawPositionId === "" || rawPositionId === undefined) {
    return { positionId: null };
  }
  const positionId = Number(rawPositionId);
  if (!Number.isInteger(positionId)) {
    return { error: "Jabatan tidak valid.", status: 400 };
  }
  const position = await prisma.position.findUnique({
    where: { id: positionId },
    include: { users: { select: { id: true, name: true } } },
  });
  if (!position) {
    return { error: "Jabatan tidak ditemukan.", status: 400 };
  }
  if (position.single) {
    const holder = position.users.find((u) => u.id !== userId);
    if (holder) {
      return {
        error: `Jabatan "${position.name}" sudah diisi oleh ${holder.name}.`,
        status: 409,
      };
    }
  }
  return { positionId };
}

// Apakah `candidateId` adalah jabatan itu sendiri atau turunannya (cegah siklus).
export async function isSelfOrDescendant(positionId, candidateId) {
  let current = candidateId;
  const seen = new Set();
  while (current != null && !seen.has(current)) {
    if (current === positionId) return true;
    seen.add(current);
    const p = await prisma.position.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = p?.parentId ?? null;
  }
  return false;
}
