import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ROLES,
  isValidStatus,
  isValidPriority,
  clampProgress,
  STATUS,
  POSITION_SELECT,
} from "@/lib/constants";
import { syncStatusProgress } from "@/lib/tasks";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notifications";
import { visibleScope, loadOrg, assignableUserIds } from "@/lib/logbook";
import { withPerms } from "@/lib/taskPerms";
import { visibleTaskWhere, inviteMode, isSelectable, MEMBER_SELECT } from "@/lib/taskAccess";
import { addPerson, notifySuperiors } from "@/lib/taskTeam";
import { sendEmail, taskReminderEmail } from "@/lib/email";

const ownerSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  position: POSITION_SELECT,
};

// Include untuk tampilan daftar: data pemilik/pembuat + ringkasan checklist
// (id & status selesai) dan jumlah komentar.
const listInclude = {
  owner: { select: ownerSelect },
  creator: { select: ownerSelect },
  checklist: { select: { id: true, done: true } },
  _count: { select: { comments: true } },
  extensions: { where: { status: "PENDING" }, select: { id: true, requestedDue: true } },
  members: { ...MEMBER_SELECT, where: { status: { not: "DECLINED" } } },
};

// GET /api/tasks  -> daftar tugas yang boleh dilihat: milik sendiri + bawahan
// (berjenjang sesuai jabatan); Admin, Direktur, Kepala SPI melihat semua.
// Filter opsional via query: ?ownerId=, ?status=, ?q=
export async function GET(request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const scope = await visibleScope(session);
  // Cakupan lihat (termasuk tugas bersama) + filter, digabung dengan AND.
  const and = [visibleTaskWhere(scope, session.id)];

  const ownerId = searchParams.get("ownerId");
  if (ownerId) {
    // Tugas milik personel tsb sebagai PIC atau anggota tim yang sudah menerima.
    const oid = Number(ownerId);
    and.push({ OR: [{ ownerId: oid }, { members: { some: { userId: oid, status: "ACCEPTED" } } }] });
  }

  const status = searchParams.get("status");
  if (status && isValidStatus(status)) and.push({ status });

  const q = (searchParams.get("q") || "").trim();
  if (q) {
    // mode "insensitive" -> pencarian tidak peka huruf besar/kecil di PostgreSQL.
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    });
  }
  const where = { AND: and };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    include: listInclude,
  });

  const assignable = assignableUserIds(scope.org, session.id, session.role);
  return Response.json({ tasks: tasks.map((t) => withPerms(t, session, assignable)) });
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

  const org = await loadOrg();
  const assignable = assignableUserIds(org, session.id, session.role);

  // Tugas bersama lintas bidang: PIC utama + anggota. PIC yang perlu
  // persetujuan (sesama tingkat/lebih tinggi) diundang dulu; sementara itu
  // pembuat menjadi pemilik tugas.
  const shared = body?.shared === true;
  let pendingPicId = null;
  let memberIds = [];

  // Tentukan pemilik tugas: diri sendiri, atau bawahan berjenjang (Admin: siapa saja).
  let ownerId = session.id;
  if (shared) {
    const picId = Number(body?.picId || session.id);
    if (!isSelectable(org, picId)) {
      return Response.json({ error: "PIC utama tidak valid." }, { status: 400 });
    }
    if (inviteMode(org, session, picId, assignable) === "direct") ownerId = picId;
    else pendingPicId = picId;
    memberIds = [...new Set((Array.isArray(body?.memberIds) ? body.memberIds : []).map(Number))].filter(
      (id) => Number.isInteger(id) && id !== picId && isSelectable(org, id),
    );
    if (memberIds.length === 0 && !pendingPicId && ownerId === session.id) {
      return Response.json({ error: "Pilih minimal satu anggota tim untuk tugas bersama." }, { status: 400 });
    }
  } else if (body?.ownerId && Number(body.ownerId) !== session.id) {
    ownerId = Number(body.ownerId);
    if (!assignable.has(ownerId)) {
      return Response.json(
        { error: "Anda hanya dapat menugaskan kepada bawahan Anda." },
        { status: 403 },
      );
    }
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
      completedAt: status === STATUS.DONE ? new Date() : null,
      ownerId,
      creatorId: session.id,
    },
    include: listInclude,
  });

  await logActivity({
    taskId: task.id,
    actorId: session.id,
    action: "CREATE_TASK",
    detail: shared
      ? `Membuat tugas bersama "${task.title}" (PIC: ${org.userById.get(pendingPicId || ownerId)?.name}${pendingPicId ? ", menunggu persetujuan" : ""})`
      : owner.id === session.id
        ? `Membuat tugas "${task.title}"`
        : `Membuat tugas "${task.title}" untuk ${owner.name}`,
  });

  if (shared) {
    if (pendingPicId) await addPerson({ org, session, assignable, task, userId: pendingPicId, role: "PIC" });
    else await notifySuperiors({ org, session, assignable, targetId: ownerId, task });
    for (const id of memberIds) await addPerson({ org, session, assignable, task, userId: id });
  }

  // Beri tahu pemilik bila tugas ditugaskan oleh orang lain.
  await notify({
    userId: owner.id,
    actorId: session.id,
    type: "ASSIGNED",
    message: `${session.name} menugaskan "${task.title}" kepada Anda`,
    taskId: task.id,
  });

  // Kirim email "tugas baru" ke penanggung jawab bila ia punya email (best-effort).
  if (owner.email) {
    const { subject, html, text } = taskReminderEmail(task, "new");
    await sendEmail({ to: owner.email, subject, html, text });
  }

  const fresh = await prisma.task.findUnique({ where: { id: task.id }, include: listInclude });
  return Response.json({ task: withPerms(fresh, session, assignable) }, { status: 201 });
}
