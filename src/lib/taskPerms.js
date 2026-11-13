import { ROLES, STATUS } from "@/lib/constants";

// Hak atas sebuah tugas (dipakai API & tampilan).
//  - "Tugas dari atasan": dibuat orang lain untuk penanggung jawab (PIC).
//  - progress : ubah status/progress & semua checklist -> PIC & Admin.
//  - manage   : pemberi tugas, atasan berjenjang PIC, & Admin; boleh mengubah
//               judul/prioritas/tenggat & memutuskan perpanjangan.
//  - core     : boleh mengubah judul, prioritas, tenggat. PIC hanya untuk
//               tugas yang ia buat sendiri; tugas dari atasan dikunci.
//  - edit     : boleh membuka form Ubah.
//  - extend   : PIC boleh mengajukan perpanjangan tenggat.
//  - team     : kelola anggota tugas bersama -> PIC, pembuat/atasan, Admin.
//  - checklist: tambah/hapus/bagi langkah -> PIC, pembuat/atasan, Admin.
//  - member   : anggota tim yang sudah menerima (centang langkah bagiannya).
//  - invited  : undangan tugas bersama untuk viewer yang menunggu jawaban.
// `assignable` = Set id user yang boleh diberi tugas oleh session (diri + bawahan).

export function isAssigned(task) {
  return task.creatorId != null && task.creatorId !== task.ownerId;
}

export function taskPerms(task, session, assignable) {
  const admin = session.role === ROLES.ADMIN;
  const owner = task.ownerId === session.id;
  const assigned = isAssigned(task);
  const mine = (task.members || []).find((m) => m.userId === session.id);
  const manage =
    admin || (!owner && (task.creatorId === session.id || Boolean(assignable?.has(task.ownerId))));
  return {
    assigned,
    progress: admin || owner,
    manage,
    core: manage || (owner && !assigned),
    edit: admin || owner || manage,
    extend: owner && assigned && task.status !== STATUS.DONE,
    team: admin || owner || manage,
    checklist: admin || owner || manage,
    member: Boolean(mine && mine.status === "ACCEPTED" && mine.role === "MEMBER"),
    invited: Boolean(mine && mine.status === "PENDING"),
  };
}

// Tambahkan `perms` ke objek tugas untuk dikirim ke klien.
export function withPerms(task, session, assignable) {
  return { ...task, perms: taskPerms(task, session, assignable) };
}
