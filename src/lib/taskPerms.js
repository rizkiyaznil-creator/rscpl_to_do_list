import { ROLES, STATUS } from "@/lib/constants";

// Hak atas sebuah tugas (dipakai API & tampilan).
//  - "Tugas dari atasan": dibuat orang lain untuk penanggung jawab.
//  - progress : ubah status/progress/checklist -> penanggung jawab & Admin.
//  - manage   : pemberi tugas, atasan berjenjang penanggung jawab, & Admin;
//               boleh mengubah judul/prioritas/tenggat & memutuskan perpanjangan.
//  - core     : boleh mengubah judul, prioritas, tenggat. Penanggung jawab
//               hanya untuk tugas pribadinya; tugas dari atasan dikunci.
//  - edit     : boleh membuka form Ubah.
//  - extend   : penanggung jawab boleh mengajukan perpanjangan tenggat.
// `assignable` = Set id user yang boleh diberi tugas oleh session (diri + bawahan).

export function isAssigned(task) {
  return task.creatorId != null && task.creatorId !== task.ownerId;
}

export function taskPerms(task, session, assignable) {
  const admin = session.role === ROLES.ADMIN;
  const owner = task.ownerId === session.id;
  const assigned = isAssigned(task);
  const manage =
    admin || (!owner && (task.creatorId === session.id || Boolean(assignable?.has(task.ownerId))));
  return {
    assigned,
    progress: admin || owner,
    manage,
    core: manage || (owner && !assigned),
    edit: admin || owner || manage,
    extend: owner && assigned && task.status !== STATUS.DONE,
  };
}

// Tambahkan `perms` ke objek tugas untuk dikirim ke klien.
export function withPerms(task, session, assignable) {
  return { ...task, perms: taskPerms(task, session, assignable) };
}
