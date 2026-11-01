"use client";

import { useState } from "react";
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

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Judul tugas wajib diisi.");
      return;
    }
    setError("");
    setSaving(true);

    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
    };
    if (canAssign) payload.ownerId = Number(ownerId);

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

          <div className="field">
            <label htmlFor="t-title">Judul tugas *</label>
            <input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="mis. Visite pasien rawat inap"
              autoFocus
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

          {canAssign && (
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
