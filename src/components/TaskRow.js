"use client";

import { useState } from "react";
import { ROLES, STATUS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { initials, formatDate, isOverdue } from "@/lib/format";

// Satu baris tabel pada Papan Tugas (alternatif dari TaskCard).
export default function TaskRow({
  task,
  currentUser,
  onUpdated,
  onDeleted,
  onEdit,
  onOpenDetail,
}) {
  const [busy, setBusy] = useState(false);

  const canModify =
    currentUser.role === ROLES.ADMIN ||
    task.ownerId === currentUser.id ||
    task.creatorId === currentUser.id;
  // Hanya admin yang boleh menghapus tugas.
  const canDelete = currentUser.role === ROLES.ADMIN;

  const checklist = task.checklist || [];
  const checklistTotal = checklist.length;
  const checklistDone = checklist.filter((c) => c.done).length;
  const hasChecklist = checklistTotal > 0;
  const commentCount = task._count?.comments ?? 0;
  const done = task.status === STATUS.DONE;
  const overdue = isOverdue(task.dueDate, task.status);

  async function patch(payload) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) onUpdated(data.task);
      else alert(data.error || "Gagal memperbarui tugas.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`Hapus tugas "${task.title}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) onDeleted(task.id);
      else alert(data.error || "Gagal menghapus.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={done ? "row-done" : ""}>
      <td>
        <button
          className="link-title"
          onClick={() => onOpenDetail(task)}
          title="Lihat detail"
        >
          {task.title}
        </button>
        <div className="row-sub">
          {hasChecklist && (
            <span>
              ☑ {checklistDone}/{checklistTotal}
            </span>
          )}
          {commentCount > 0 && <span>💬 {commentCount}</span>}
        </div>
      </td>
      <td>
        <div className="owner-line">
          <span className="avatar">{initials(task.owner?.name)}</span>
          <div>
            <b>{task.owner?.name}</b>
            <div className="muted-sm">{task.owner?.department || "—"}</div>
          </div>
        </div>
      </td>
      <td>
        <span className={`prio prio-${task.priority}`}>
          ● {PRIORITY_LABELS[task.priority]}
        </span>
      </td>
      <td>
        {canModify && !hasChecklist ? (
          <select
            value={task.status}
            onChange={(e) => patch({ status: e.target.value })}
            disabled={busy}
          >
            {Object.values(STATUS).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        ) : (
          <span className={`badge status-${task.status}`}>
            {STATUS_LABELS[task.status]}
          </span>
        )}
      </td>
      <td>
        {task.dueDate ? (
          <span className={overdue ? "due overdue" : "due"}>
            {formatDate(task.dueDate)}
            {overdue ? " (lewat)" : ""}
          </span>
        ) : (
          <span className="muted-sm">—</span>
        )}
      </td>
      <td>
        <div className="row-progress">
          <div className={`bar ${done ? "done" : ""}`}>
            <span style={{ width: `${task.progress}%` }} />
          </div>
          <span className="pct">{task.progress}%</span>
        </div>
      </td>
      <td>
        <div className="row-actions">
          <button className="btn btn-sm" onClick={() => onOpenDetail(task)}>
            Detail
          </button>
          {canModify && (
            <button
              className="btn btn-sm"
              onClick={() => onEdit(task)}
              disabled={busy}
            >
              Ubah
            </button>
          )}
          {canDelete && (
            <button
              className="btn btn-sm btn-danger"
              onClick={remove}
              disabled={busy}
            >
              Hapus
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
