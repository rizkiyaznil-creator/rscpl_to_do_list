"use client";

import { useState, useEffect, useMemo } from "react";
import TopBar from "@/components/TopBar";
import TaskCard from "@/components/TaskCard";
import TaskRow from "@/components/TaskRow";
import TaskFormModal from "@/components/TaskFormModal";
import TaskDetailModal from "@/components/TaskDetailModal";
import TaskExportModal from "@/components/TaskExportModal";
import { STATUS, STATUS_LABELS, STATUS_ORDER, PRIORITY_ORDER } from "@/lib/constants";

const SHOW_DONE_KEY = "tugas.showDone";

export default function Board({ currentUser }) {
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignableIds, setAssignableIds] = useState([]); // diri sendiri + bawahan
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
  // Urutan bawaan: prioritas (Tinggi dulu), lalu tenggat terdekat.
  const [sort, setSort] = useState({ key: "priority", dir: "asc" });
  // Kelompok "Selesai" tertutup secara bawaan; pilihan diingat per perangkat.
  const [showDone, setShowDone] = useState(false);
  const [showExport, setShowExport] = useState(false);

  useEffect(() => {
    try {
      setShowDone(localStorage.getItem(SHOW_DONE_KEY) === "1");
    } catch {
      /* penyimpanan tidak tersedia */
    }
  }, []);

  function toggleDone() {
    setShowDone((v) => {
      try {
        localStorage.setItem(SHOW_DONE_KEY, v ? "0" : "1");
      } catch {
        /* abaikan */
      }
      return !v;
    });
  }

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
        if (uRes.ok) {
          setUsers(uData.users || []);
          setAssignableIds(uData.assignableIds || []);
        }
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
      window.history.replaceState({}, "", "/tugas");
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
    const due = (t) => (t.dueDate ? new Date(t.dueDate).getTime() : Infinity);
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
      // Nilai sama -> tenggat terdekat dulu.
      return due(a) - due(b);
    });
  }, [filtered, sort]);

  // Dua kelompok: belum selesai di atas, selesai di bawah (urutan kolom tetap berlaku).
  // Undangan tugas bersama yang menunggu jawaban saya (tampil terpisah di atas).
  const invites = sorted.filter((t) => t.perms?.invited);
  const openTasks = sorted.filter((t) => t.status !== STATUS.DONE && !t.perms?.invited);
  // Belum selesai dibagi lagi: tugas saya (PIC atau anggota tim) dulu, lalu
  // tugas bawahan/personel lain.
  const isMine = (t) => t.ownerId === currentUser.id || Boolean(t.perms?.member);
  const myOpen = openTasks.filter(isMine);
  const teamOpen = openTasks.filter((t) => !isMine(t));
  const doneTasks = sorted.filter((t) => t.status === STATUS.DONE && !t.perms?.invited);
  // Saring "Selesai" -> kelompok selesai selalu terbuka.
  const doneVisible = showDone || statusFilter === STATUS.DONE;

  // Keterangan filter untuk laporan ekspor.
  const filterLabel = [
    ownerFilter === "all"
      ? "Semua personel"
      : ownerFilter === "mine"
        ? `Tugas ${currentUser.name}`
        : users.find((u) => u.id === Number(ownerFilter))?.name || "Personel",
    statusFilter === "all" ? "semua status" : STATUS_LABELS[statusFilter],
    q.trim() ? `pencarian "${q.trim()}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

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

  // Tabel atau kartu untuk satu kelompok tugas.
  function renderList(list) {
    const common = {
      currentUser,
      onUpdated: handleUpdated,
      onDeleted: handleDeleted,
      onEdit: openEdit,
      onOpenDetail: (t) => setDetailTaskId(t.id),
    };
    return view === "table" ? (
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
            {list.map((task) => (
              <TaskRow key={task.id} task={task} {...common} />
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <div className="task-grid">
        {list.map((task) => (
          <TaskCard key={task.id} task={task} {...common} />
        ))}
      </div>
    );
  }

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
              <button className="btn btn-sm" onClick={() => setShowExport(true)}>
                ⬇ Ekspor laporan
              </button>
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

            {invites.length > 0 && (
              <>
                <div className="group-head">
                  <h3>📨 Undangan tugas bersama</h3>
                  <span className="count">{invites.length}</span>
                  <span className="muted-sm">menunggu jawaban Anda</span>
                </div>
                <div className="invites">
                  {invites.map((t) => (
                    <div key={t.id} className="invite-card">
                      <span className="grow">
                        <b>{t.title}</b>
                        <br />
                        <small className="muted-sm">
                          dari {t.creator?.name || "-"}
                          {t.dueDate ? ` · tenggat ${new Date(t.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}` : ""}
                        </small>
                      </span>
                      <button className="btn btn-sm btn-primary" onClick={() => setDetailTaskId(t.id)}>
                        Lihat &amp; jawab
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {statusFilter !== STATUS.DONE && openTasks.length === 0 && (
              <>
                <div className="group-head">
                  <h3>⏳ Belum selesai</h3>
                  <span className="count">0</span>
                </div>
                <p className="muted-sm group-empty">Semua tugas sudah selesai. 🎉</p>
              </>
            )}
            {statusFilter !== STATUS.DONE && myOpen.length > 0 && (
              <>
                <div className="group-head">
                  <h3>👤 Tugas Saya</h3>
                  <span className="count">{myOpen.length}</span>
                  <span className="muted-sm">belum selesai</span>
                </div>
                {renderList(myOpen)}
              </>
            )}
            {statusFilter !== STATUS.DONE && teamOpen.length > 0 && (
              <>
                <div className="group-head">
                  <h3>👥 Tugas Bawahan</h3>
                  <span className="count">{teamOpen.length}</span>
                  <span className="muted-sm">belum selesai</span>
                </div>
                {renderList(teamOpen)}
              </>
            )}

            {doneTasks.length > 0 && (
              <>
                <div className="group-head done">
                  <h3>✅ Selesai</h3>
                  <span className="count">{doneTasks.length}</span>
                  <div className="spacer" />
                  {statusFilter !== STATUS.DONE && (
                    <button className="btn btn-sm" onClick={toggleDone}>
                      {doneVisible ? "Sembunyikan" : `Tampilkan ${doneTasks.length} tugas selesai`}
                    </button>
                  )}
                </div>
                {doneVisible && renderList(doneTasks)}
              </>
            )}
          </>
        )}
      </main>

      {showForm && (
        <TaskFormModal
          currentUser={currentUser}
          users={users}
          assignableIds={assignableIds}
          task={editingTask}
          onClose={() => {
            setShowForm(false);
            setEditingTask(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {showExport && (
        <TaskExportModal
          tasks={filtered}
          filterLabel={filterLabel}
          currentUser={currentUser}
          onClose={() => setShowExport(false)}
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
