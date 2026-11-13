"use client";

import { useState, useEffect } from "react";
import MemberPicker, { loadDirectory, MODE_LABEL } from "@/components/MemberPicker";
import { ROLES, PRIORITY, PRIORITY_LABELS, POSITION_LEVELS, POSITION_LEVEL_LABELS } from "@/lib/constants";
import { toDateInput } from "@/lib/format";

// Kelompokkan calon penanggung jawab per level jabatan (Wadir, Manajer, ...).
function groupByLevel(list) {
  const groups = [];
  for (const level of [...POSITION_LEVELS, null]) {
    const members = list.filter((u) => (u.position?.level ?? null) === level);
    if (members.length) {
      groups.push({ label: level ? POSITION_LEVEL_LABELS[level] : "Tanpa jabatan", members });
    }
  }
  return groups;
}

export default function TaskFormModal({ currentUser, users, assignableIds = [], task, onClose, onSaved }) {
  const isEdit = Boolean(task);
  const isAdmin = currentUser.role === ROLES.ADMIN;
  // Tugas baru: boleh ditugaskan ke bawahan berjenjang (Admin: siapa saja).
  // Mengubah penanggung jawab tugas yang sudah ada: hanya Admin.
  const others = users
    .filter((u) => u.id !== currentUser.id && assignableIds.includes(u.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const canAssign = isEdit ? isAdmin : others.length > 0;

  const [title, setTitle] = useState(task?.title || "");
  const [description, setDescription] = useState(task?.description || "");
  const [priority, setPriority] = useState(task?.priority || PRIORITY.MEDIUM);
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [ownerId, setOwnerId] = useState(
    task?.ownerId || currentUser.id,
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Tugas dari atasan: judul, prioritas & tenggat dikunci bagi penanggung jawab.
  const locked = isEdit && task.perms && !task.perms.core;
  // Tugas bersama lintas bidang (hanya saat membuat tugas baru).
  const [shared, setShared] = useState(false);
  const [picId, setPicId] = useState(currentUser.id);
  const [memberIds, setMemberIds] = useState([]);
  const [directory, setDirectory] = useState([]);
  useEffect(() => {
    if (shared && !directory.length) loadDirectory().then(setDirectory).catch(() => {});
  }, [shared, directory.length]);
  // Calon PIC: diri sendiri atau bawahan berjenjang (Direktur & Admin: semua).
  const picChoices = directory.filter((u) => u.canPic && u.id !== currentUser.id);
  const bidangGroups = [...new Set(picChoices.map((u) => u.position?.bidang || "Tanpa jabatan"))];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul tugas wajib diisi.");
      return;
    }
    setError("");
    setSaving(true);

    const payload = locked
      ? { description: description.trim() }
      : {
          title: title.trim(),
          description: description.trim(),
          priority,
          dueDate: dueDate || null,
        };
    if (shared) {
      payload.shared = true;
      payload.picId = Number(picId);
      payload.memberIds = memberIds.filter((id) => id !== Number(picId));
      if (payload.memberIds.length === 0 && Number(picId) === currentUser.id) {
        setError("Pilih minimal satu anggota tim, atau pilih PIC lain.");
        setSaving(false);
        return;
      }
    } else if (canAssign) payload.ownerId = Number(ownerId);

    try {
      const res = await fetch(isEdit ? `/api/tasks/${task.id}` : "/api/tasks", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan tugas.");
        setSaving(false);
        return;
      }
      onSaved(data.task, !isEdit);
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isEdit ? "Ubah Tugas" : "Tambah Tugas"}</h3>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          {locked && (
            <div className="alert alert-warn">
              🔒 Tugas ini diberikan oleh <b>{task.creator?.name || "atasan"}</b>. Judul, prioritas, dan tenggat
              hanya dapat diubah pemberi tugas. Butuh waktu lebih? Buka <b>Detail</b> → <b>Ajukan perpanjangan</b>.
            </div>
          )}

          <div className="field">
            <label htmlFor="t-title">Judul tugas *</label>
            <input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Visite pasien rawat inap"
              autoFocus={!locked}
              disabled={locked}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="t-desc">Deskripsi</label>
            <textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rincian pekerjaan (opsional)"
            />
          </div>

          {!isEdit && (
            <label className="shared-toggle">
              <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
              <span>
                <b>👥 Tugas bersama</b> — melibatkan personel lintas manajer/bidang
              </span>
            </label>
          )}

          {shared && (
            <>
              <div className="field">
                <label htmlFor="t-pic">PIC utama (penanggung jawab utama)</label>
                <select id="t-pic" value={picId} onChange={(e) => setPicId(Number(e.target.value))}>
                  <option value={currentUser.id}>Saya sendiri</option>
                  {bidangGroups.map((b) => (
                    <optgroup key={b} label={b}>
                      {picChoices
                        .filter((u) => (u.position?.bidang || "Tanpa jabatan") === b)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                            {u.position ? ` — ${u.position.name}` : ""}
                          </option>
                        ))}
                    </optgroup>
                  ))}
                </select>
                {!isAdmin && (
                  <small className="muted-sm">PIC dipilih dari Anda sendiri atau bawahan Anda.</small>
                )}
              </div>
              <div className="field">
                <label>Anggota tim</label>
                <MemberPicker value={memberIds} onChange={setMemberIds} exclude={[Number(picId), currentUser.id]} />
                <small className="muted-sm">
                  Atasan → tingkat di bawahnya <b>{MODE_LABEL.direct}</b> masuk. Sesama tingkat atau tingkat lebih
                  tinggi menerima undangan dan <b>{MODE_LABEL.approval}</b>.
                </small>
              </div>
            </>
          )}

          {canAssign && !shared && (
            <div className="field">
              <label htmlFor="t-owner">Ditugaskan kepada</label>
              <select
                id="t-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value={currentUser.id}>Saya sendiri</option>
                {groupByLevel(isEdit && isAdmin ? users.filter((u) => u.id !== currentUser.id) : others).map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.members.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.position ? ` — ${u.position.name}` : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {!isAdmin && (
                <small className="muted-sm">
                  Hanya bawahan Anda yang dapat dipilih. Mereka akan menerima notifikasi & email.
                </small>
              )}
            </div>
          )}

          <div className="field-row">
            <div className="field">
              <label htmlFor="t-prio">Prioritas</label>
              <select
                id="t-prio"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                disabled={locked}
              >
                {Object.values(PRIORITY).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="t-due">Tenggat</label>
              <input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={locked}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : isEdit ? "Simpan" : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
