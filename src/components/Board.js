"use client";

import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import TaskCard from "@/components/TaskCard";
import TaskRow from "@/components/TaskRow";
import TaskFormModal from "@/components/TaskFormModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import { STATUS, STATUS_LABELS, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";

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

  // Tampilan papan: "table" (default, bisa disortir) atau "card".
  const [view, setView] = useState("table");
  const [sort, setSort] = useState({ key: "dueDate", dir: "asc" });

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

  // Buka modal detail bila lonceng notifikasi memintanya, atau bila URL
  // mengandung ?task=<id> (mis. datang dari halaman lain via notifikasi).
  useEffect(() => {
    function onOpenDetail(e) {
      const id = e?.detail?.taskId;
      if (id) {
        setDetailTaskId(Number(id));
        e.preventDefault(); // beri tahu pemicu bahwa kita menanganinya
      }
    }
    window.addEventListener("open-task-detail", onOpenDetail);

    const params = new URLSearchParams(window.location.search);
    const t = params.get("task");
    if (t) {
      setDetailTaskId(Number(t));
      // Bersihkan query agar tidak terbuka ulang saat refresh.
      window.history.replaceState({}, "", "/dashboard");
    }

    return () => window.removeEventListener("open-task-detail", onOpenDetail);
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

  // Urutkan hasil filter sesuai kolom yang dipilih.
  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const mul = dir === "asc" ? 1 : -1;
    const val = (t) => {
      switch (key) {
        case "title":
          return (t.title || "").toLowerCase();
        case "owner":
          return (t.owner?.name || "").toLowerCase();
        case "priority":
          return PRIORITY_ORDER.indexOf(t.priority); // 0 = Tinggi
        case "status":
          return STATUS_ORDER.indexOf(t.status); // 0 = Belum dikerjakan
        case "progress":
          return t.progress ?? 0;
        case "dueDate":
          return t.dueDate ? new Date(t.dueDate).getTime() : null;
        default:
          return 0;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      if (key === "dueDate") {
        // Tugas tanpa tenggat selalu di bawah.
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
      }
      if (va < vb) return -1 * mul;
      if (va > vb) return 1 * mul;
      return 0;
    });
  }, [filtered, sort]);

  function toggleSort(key) {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  // Header kolom yang bisa diklik untuk menyortir.
  const renderTh = (label, k) => {
    const active = sort.key === k;
    return (
      <th className="th-sort" onClick={() => toggleSort(k)}>
        {label}{" "}
        <span className="sort-ind">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </th>
    );
  };

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
              <div className="spacer" />
              <div className="view-toggle">
                <button
                  className={`btn btn-sm ${view === "table" ? "btn-primary" : ""}`}
                  onClick={() => setView("table")}
                >
                  ▤ Tabel
                </button>
                <button
                  className={`btn btn-sm ${view === "card" ? "btn-primary" : ""}`}
                  onClick={() => setView("card")}
                >
                  ▦ Kartu
                </button>
              </div>
            </div>

            {view === "table" ? (
              <div className="table-wrap">
                <table className="table task-table">
                  <thead>
                    <tr>
                      {renderTh("Tugas", "title")}
                      {renderTh("Penanggung jawab", "owner")}
                      {renderTh("Prioritas", "priority")}
                      {renderTh("Status", "status")}
                      {renderTh("Tenggat", "dueDate")}
                      {renderTh("Progress", "progress")}
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((task) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        currentUser={currentUser}
                        onUpdated={handleUpdated}
                        onDeleted={handleDeleted}
                        onEdit={openEdit}
                        onOpenDetail={(t) => setDetailTaskId(t.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="task-grid">
                {sorted.map((task) => (
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
            )}
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
