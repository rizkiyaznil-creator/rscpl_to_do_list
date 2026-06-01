"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ROLES,
  STATUS,
  STATUS_LABELS,
  PRIORITY_LABELS,
} from "@/lib/constants";
import { initials, formatDate, timeAgo, isOverdue } from "@/lib/format";

export default function TaskDetailModal({ taskId, currentUser, onClose, onChanged }) {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newItem, setNewItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`);
      const data = await res.json();
      if (res.ok) setTask(data.task);
      else setError(data.error || "Gagal memuat detail.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    load();
  }, [load]);

  // Panggil setelah mutasi yang mengubah ringkasan kartu di papan.
  async function refresh() {
    await load();
    onChanged?.();
  }

  const canModify =
    task &&
    (currentUser.role === ROLES.ADMIN ||
      task.ownerId === currentUser.id ||
      task.creatorId === currentUser.id);

  // ----- Checklist -----
  async function addItem(e) {
    e.preventDefault();
    const text = newItem.trim();
    if (!text) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        setNewItem("");
        await refresh();
      } else {
        const d = await res.json();
        alert(d.error || "Gagal menambah langkah.");
      }
    } finally {
      setPosting(false);
    }
  }

  async function toggleItem(item) {
    const res = await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    if (res.ok) await refresh();
    else alert("Gagal memperbarui langkah.");
  }

  async function deleteItem(item) {
    const res = await fetch(`/api/tasks/${taskId}/checklist/${item.id}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
    else alert("Gagal menghapus langkah.");
  }

  // ----- Komentar -----
  async function addComment(e) {
    e.preventDefault();
    const body = newComment.trim();
    if (!body) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (res.ok) {
        setNewComment("");
        await refresh();
      } else {
        const d = await res.json();
        alert(d.error || "Gagal mengirim komentar.");
      }
    } finally {
      setPosting(false);
    }
  }

  async function deleteComment(c) {
    if (!confirm("Hapus komentar ini?")) return;
    const res = await fetch(`/api/tasks/${taskId}/comments/${c.id}`, {
      method: "DELETE",
    });
    if (res.ok) await refresh();
    else alert("Gagal menghapus komentar.");
  }

  const checklist = task?.checklist || [];
  const doneCount = checklist.filter((c) => c.done).length;
  const overdue = task && isOverdue(task.dueDate, task.status);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <div className="empty">Memuat detail...</div>
        ) : error ? (
          <div className="alert alert-error">{error}</div>
        ) : (
          <>
            <div className="detail-head">
              <div>
                <span className={`badge status-${task.status}`}>
                  {STATUS_LABELS[task.status]}
                </span>{" "}
                <span className={`prio prio-${task.priority}`}>
                  ● {PRIORITY_LABELS[task.priority]}
                </span>
                <h3 style={{ margin: "8px 0 0" }}>{task.title}</h3>
              </div>
              <button className="btn btn-sm btn-ghost" onClick={onClose}>
                ✕
              </button>
            </div>

            {task.description && (
              <p className="card-desc" style={{ marginTop: 0 }}>
                {task.description}
              </p>
            )}

            <div className="detail-meta">
              <span className="owner-line">
                <span className="avatar">{initials(task.owner?.name)}</span>
                <span>
                  <b>{task.owner?.name}</b>
                  <br />
                  <small style={{ color: "var(--text-muted)" }}>
                    {task.owner?.department || "—"}
                  </small>
                </span>
              </span>
              {task.dueDate && (
                <span className={`due ${overdue ? "overdue" : ""}`}>
                  🗓 Tenggat: {formatDate(task.dueDate)}
                  {overdue ? " (lewat)" : ""}
                </span>
              )}
              {task.creator && <span>Dibuat oleh {task.creator.name}</span>}
            </div>

            <div className="progress-row" style={{ marginBottom: 4 }}>
              <div className={`bar ${task.status === STATUS.DONE ? "done" : ""}`}>
                <span style={{ width: `${task.progress}%` }} />
              </div>
              <span className="pct">{task.progress}%</span>
            </div>

            {/* ---------- Checklist ---------- */}
            <section className="detail-section">
              <h4>
                Sub-tugas / Checklist{" "}
                {checklist.length > 0 && (
                  <span className="count">
                    {doneCount}/{checklist.length}
                  </span>
                )}
              </h4>
              {checklist.length === 0 && (
                <p className="muted-sm">
                  Belum ada langkah. {canModify && "Tambahkan untuk memecah tugas; progress dihitung otomatis."}
                </p>
              )}
              <ul className="checklist">
                {checklist.map((item) => (
                  <li key={item.id} className={item.done ? "done" : ""}>
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={item.done}
                        disabled={!canModify}
                        onChange={() => toggleItem(item)}
                      />
                      <span>{item.text}</span>
                    </label>
                    {canModify && (
                      <button
                        className="icon-btn"
                        title="Hapus langkah"
                        onClick={() => deleteItem(item)}
                      >
                        ✕
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canModify && (
                <form onSubmit={addItem} className="inline-form">
                  <input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    placeholder="Tambah langkah..."
                  />
                  <button className="btn btn-sm btn-primary" disabled={posting}>
                    Tambah
                  </button>
                </form>
              )}
            </section>

            {/* ---------- Komentar / Handover ---------- */}
            <section className="detail-section">
              <h4>
                Komentar &amp; Handover{" "}
                {task.comments.length > 0 && (
                  <span className="count">{task.comments.length}</span>
                )}
              </h4>
              <div className="comments">
                {task.comments.length === 0 && (
                  <p className="muted-sm">
                    Belum ada komentar. Tulis catatan serah-terima di sini.
                  </p>
                )}
                {task.comments.map((c) => (
                  <div key={c.id} className="comment">
                    <span className="avatar sm">{initials(c.author?.name)}</span>
                    <div className="comment-body">
                      <div className="comment-head">
                        <b>{c.author?.name || "Pengguna"}</b>
                        <small>{timeAgo(c.createdAt)}</small>
                        {(currentUser.role === ROLES.ADMIN ||
                          c.author?.id === currentUser.id) && (
                          <button
                            className="icon-btn"
                            title="Hapus"
                            onClick={() => deleteComment(c)}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      <p>{c.body}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={addComment} className="inline-form">
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Tulis komentar / catatan handover..."
                />
                <button className="btn btn-sm btn-primary" disabled={posting}>
                  Kirim
                </button>
              </form>
            </section>

            {/* ---------- Riwayat aktivitas ---------- */}
            <section className="detail-section">
              <h4>Riwayat Aktivitas</h4>
              <ul className="activity">
                {task.activities.length === 0 && (
                  <li className="muted-sm">Belum ada aktivitas.</li>
                )}
                {task.activities.map((a) => (
                  <li key={a.id}>
                    <span className="dot" />
                    <span>
                      <b>{a.actor?.name || "Sistem"}</b> — {a.detail || a.action}
                      <small> · {timeAgo(a.createdAt)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
