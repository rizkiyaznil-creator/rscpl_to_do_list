"use client";

import { useState, useEffect } from "react";
import {
  ROLES,
  STATUS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/constants";
import { initials, formatDate, isOverdue } from "@/lib/format";

export default function TaskCard({ task, currentUser, onUpdated, onDeleted, onEdit }) {
  const [progress, setProgress] = useState(task.progress);
  const [busy, setBusy] = useState(false);

  // Sinkronkan bila task dari parent berubah (mis. setelah edit).
  useEffect(() => {
    setProgress(task.progress);
  }, [task.progress]);

  const canModify =
    currentUser.role === ROLES.ADMIN ||
    task.ownerId === currentUser.id ||
    task.creatorId === currentUser.id;

  async function patch(payload) {
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.task);
      } else {
        alert(data.error || "Gagal memperbarui tugas.");
        setProgress(task.progress);
      }
    } catch {
      alert("Tidak dapat terhubung ke server.");
      setProgress(task.progress);
    } finally {
      setBusy(false);
    }
  }

  function commitProgress() {
    if (progress !== task.progress) patch({ progress });
  }

  function changeStatus(e) {
    patch({ status: e.target.value });
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

  const done = task.status === STATUS.DONE;
  const overdue = isOverdue(task.dueDate, task.status);

  return (
    <article className={`card ${done ? "done" : ""}`}>
      <div className="card-top">
        <h3 className="card-title">{task.title}</h3>
        <span className={`badge status-${task.status}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {task.description && <p className="card-desc">{task.description}</p>}

      <div className="owner-line">
        <span className="avatar">{initials(task.owner?.name)}</span>
        <div>
          <b>{task.owner?.name}</b>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {task.owner?.department || "—"}
          </div>
        </div>
      </div>

      <div className="card-meta">
        <span className={`prio prio-${task.priority}`}>
          ● {PRIORITY_LABELS[task.priority]}
        </span>
        {task.dueDate && (
          <span className={`due ${overdue ? "overdue" : ""}`}>
            🗓 {formatDate(task.dueDate)}
            {overdue ? " (lewat)" : ""}
          </span>
        )}
        {task.creator && (
          <span>oleh {task.creator.name}</span>
        )}
      </div>

      <div className="progress-row">
        <div className={`bar ${done ? "done" : ""}`}>
          <span style={{ width: `${progress}%` }} />
        </div>
        <span className="pct">{progress}%</span>
      </div>

      {canModify ? (
        <>
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={progress}
            disabled={busy}
            onChange={(e) => setProgress(Number(e.target.value))}
            onMouseUp={commitProgress}
            onTouchEnd={commitProgress}
            onKeyUp={commitProgress}
            aria-label="Atur progress"
          />
          <div className="card-actions">
            <select value={task.status} onChange={changeStatus} disabled={busy}>
              {Object.values(STATUS).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <div className="spacer" />
            <button className="btn btn-sm" onClick={() => onEdit(task)} disabled={busy}>
              Ubah
            </button>
            <button className="btn btn-sm btn-danger" onClick={remove} disabled={busy}>
              Hapus
            </button>
          </div>
        </>
      ) : (
        <div className="card-actions">
          <span className="readonly-note">
            Hanya pemilik/admin yang dapat mengubah tugas ini.
          </span>
        </div>
      )}
    </article>
  );
}
