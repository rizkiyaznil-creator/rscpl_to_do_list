import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  isValidStatus,
  isValidPriority,
  clampProgress,
  STATUS,
} from "@/lib/constants";
import { syncStatusProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";

const ownerSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  department: true,
};

// Include untuk tampilan daftar: data pemilik/pembuat + ringkasan checklist
// (id & status selesai) dan jumlah komentar.
const listInclude = {
  owner: { select: ownerSelect },
  creator: { select: ownerSelect },
  checklist: { select: { id: true, done: true } },
  _count: { select: { comments: true } },
};

// GET /api/tasks  -> daftar SEMUA tugas (papan transparan untuk semua personel).
// Filter opsional via query: ?ownerId=, ?status=, ?q=
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const where = {};

  const ownerId = searchParams.get("ownerId");
  if (ownerId) where.ownerId = Number(ownerId);

  const status = searchParams.get("status");
  if (status && isValidStatus(status)) where.status = status;

  const q = (searchParams.get("q") || "").trim();
  if (q) {
    where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
  }

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: listInclude,
  });

  return Response.json({ tasks });
}

// POST /api/tasks  -> buat tugas baru.
// STAFF hanya boleh membuat tugas untuk dirinya sendiri.
// ADMIN boleh menugaskan ke personel mana pun (ownerId).
export async function POST(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const title = (body?.title || "").trim();
  if (!title) {
    return Response.json({ error: "Judul tugas wajib diisi." }, { status: 400 });
  }

  // Tentukan pemilik tugas.
  let ownerId = session.id;
  if (session.role === ROLES.ADMIN && body?.ownerId) {
    ownerId = Number(body.ownerId);
  }

  // Pastikan pemilik ada.
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  if (!owner) {
    return Response.json({ error: "Personel tujuan tidak ditemukan." }, { status: 400 });
  }

  const priority = isValidPriority(body?.priority) ? body.priority : "MEDIUM";
  let status = isValidStatus(body?.status) ? body.status : STATUS.TODO;
  let progress = clampProgress(body?.progress ?? 0);

  // Selaraskan status & progress.
  ({ status, progress } = syncStatusProgress(status, progress));

  let dueDate = null;
  if (body?.dueDate) {
    const d = new Date(body.dueDate);
    if (!Number.isNaN(d.getTime())) dueDate = d;
  }

  const task = await prisma.task.create({
    data: {
      title,
      description: (body?.description || "").trim() || null,
      status,
      progress,
      priority,
      dueDate,
      ownerId,
      creatorId: session.id,
    },
    include: listInclude,
  });

  await logActivity({
    taskId: task.id,
    actorId: session.id,
    action: "CREATE_TASK",
    detail:
      owner.id === session.id
        ? `Membuat tugas "${task.title}"`
        : `Membuat tugas "${task.title}" untuk ${owner.name}`,
  });

  return Response.json({ task }, { status: 201 });
}
