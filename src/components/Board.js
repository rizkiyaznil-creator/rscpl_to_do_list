"use client";

import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import TaskCard from "@/components/TaskCard";
import TaskFormModal from "@/components/TaskFormModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import { STATUS, STATUS_LABELS } from "@/lib/constants";

export default function Board({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter UI
  const [q, setQ] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all"); // "all" | "mine" | userId
  const [statusFilter, setStatusFilter] = useState("all");

  // Modal
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [detailTaskId, setDetailTaskId] = useState(null);

  // Muat ulang daftar tugas (dipakai setelah perubahan dari modal detail).
  async function reloadTasks() {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      if (res.ok) setTasks(data.tasks || []);
    } catch {
      /* abaikan; biarkan state lama */
    }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [tRes, uRes] = await Promise.all([
          fetch("/api/tasks"),
          fetch("/api/users"),
        ]);
        const tData = await tRes.json();
        const uData = await uRes.json();
        if (!active) return;
        if (tRes.ok) setTasks(tData.tasks || []);
        else setError(tData.error || "Gagal memuat tugas.");
        if (uRes.ok) setUsers(uData.users || []);
      } catch {
        if (active) setError("Tidak dapat terhubung ke server.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    const s = { total: tasks.length, TODO: 0, IN_PROGRESS: 0, DONE: 0 };
    for (const t of tasks) s[t.status] = (s[t.status] || 0) + 1;
    return s;
  }, [tasks]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (ownerFilter === "mine" && t.ownerId !== currentUser.id) return false;
      if (
        ownerFilter !== "all" &&
        ownerFilter !== "mine" &&
        t.ownerId !== Number(ownerFilter)
      )
        return false;
      if (term) {
        const hay = `${t.title} ${t.description || ""} ${
          t.owner?.name || ""
        }`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tasks, q, ownerFilter, statusFilter, currentUser.id]);

  function handleUpdated(updated) {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }
  function handleDeleted(id) {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }
  function handleSaved(saved, isNew) {
    setTasks((prev) =>
      isNew ? [saved, ...prev] : prev.map((t) => (t.id === saved.id ? saved : t)),
    );
    setShowForm(false);
    setEditingTask(null);
  }
  function openCreate() {
    setEditingTask(null);
    setShowForm(true);
  }
  function openEdit(task) {
    setEditingTask(task);
    setShowForm(true);
  }

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="stats">
          <div className="stat">
            <div className="num">{stats.total}</div>
            <div className="lbl">Total tugas</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: "var(--todo)" }}>
              {stats.TODO}
            </div>
            <div className="lbl">Belum dikerjakan</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: "var(--progress)" }}>
              {stats.IN_PROGRESS}
            </div>
            <div className="lbl">Sedang dikerjakan</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: "var(--done)" }}>
              {stats.DONE}
            </div>
            <div className="lbl">Selesai</div>
          </div>
        </div>

        <div className="toolbar">
          <input
            className="grow"
            type="search"
            placeholder="Cari tugas, deskripsi, atau personel..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)}>
            <option value="all">Semua personel</option>
            <option value="mine">Tugas saya</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Semua status</option>
            {Object.values(STATUS).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={openCreate}>
            + Tambah Tugas
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty">Memuat data...</div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="big">🗂️</div>
            <p>Tidak ada tugas yang cocok dengan filter.</p>
            <button className="btn btn-primary" onClick={openCreate}>
              + Tambah Tugas
            </button>
          </div>
        ) : (
          <>
            <div className="section-head">
              <h2>Papan Tugas</h2>
              <span className="count">{filtered.length} tugas</span>
            </div>
            <div className="task-grid">
              {filtered.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUser={currentUser}
                  onUpdated={handleUpdated}
                  onDeleted={handleDeleted}
                  onEdit={openEdit}
                  onOpenDetail={(t) => setDetailTaskId(t.id)}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {showForm && (
        <TaskFormModal
          currentUser={currentUser}
          users={users}
          task={editingTask}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {detailTaskId && (
        <TaskDetailModal
          taskId={detailTaskId}
          currentUser={currentUser}
          onClose={() => setDetailTaskId(null)}
          onChanged={reloadTasks}
        />
      )}
    </>
  );
}
