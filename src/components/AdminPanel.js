"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { ROLES, ROLE_LABELS, USER_STATUS } from "@/lib/constants";
import { initials } from "@/lib/format";

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/users")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!active) return;
        if (ok) setUsers(d.users || []);
        else setError(d.error || "Gagal memuat data.");
      })
      .catch(() => active && setError("Tidak dapat terhubung ke server."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  function handleCreated(user) {
    setUsers((prev) => [...prev, user]);
    setShowForm(false);
  }

  async function removeUser(u) {
    if (
      !confirm(
        `Hapus akun "${u.name}"? Semua tugas miliknya (${u._count?.ownedTasks ?? 0}) akan ikut terhapus.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
      else alert(data.error || "Gagal menghapus.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  // Verifikasi pendaftar: ubah status PENDING -> ACTIVE.
  async function approveUser(u) {
    try {
      const res = await fetch(`/api/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: USER_STATUS.ACTIVE }),
      });
      const data = await res.json();
      if (res.ok) setUsers((prev) => prev.map((x) => (x.id === u.id ? data.user : x)));
      else alert(data.error || "Gagal memverifikasi.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  // Tolak pendaftar: hapus akunnya (belum punya data sehingga aman dihapus).
  async function rejectUser(u) {
    if (!confirm(`Tolak & hapus pendaftaran "${u.name}" (@${u.username})?`)) return;
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) setUsers((prev) => prev.filter((x) => x.id !== u.id));
      else alert(data.error || "Gagal menolak.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  const pending = users.filter((u) => u.status === USER_STATUS.PENDING);
  const active = users.filter((u) => u.status !== USER_STATUS.PENDING);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <Link href="/dashboard" className="btn btn-sm btn-ghost">
            ← Kembali
          </Link>
          <h2 style={{ fontSize: 20 }}>Kelola Personel</h2>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Tambah Personel
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty">Memuat data...</div>
        ) : (
          <>
            {/* Pendaftar yang menunggu verifikasi admin (tampilan kartu, ramah HP) */}
            {pending.length > 0 && (
              <div className="pending-card">
                <div className="pending-card-head">
                  <b>⏳ Menunggu verifikasi</b>
                  <span className="badge badge-pending">{pending.length}</span>
                </div>
                <ul className="pending-list">
                  {pending.map((u) => (
                    <li key={u.id} className="pending-item">
                      <div className="owner-line">
                        <span className="avatar">{initials(u.name)}</span>
                        <div className="pending-meta">
                          <b>{u.name}</b>
                          <small>
                            @{u.username}
                            {u.department ? ` · ${u.department}` : ""}
                          </small>
                        </div>
                      </div>
                      <div className="pending-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => approveUser(u)}
                        >
                          ✓ Verifikasi
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => rejectUser(u)}
                        >
                          Tolak
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Username</th>
                    <th>Departemen</th>
                    <th>Peran</th>
                    <th>Tugas</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="owner-line">
                          <span className="avatar">{initials(u.name)}</span>
                          <b>{u.name}</b>
                        </div>
                      </td>
                      <td>{u.username}</td>
                      <td>{u.department || "—"}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.role === ROLES.ADMIN ? "badge-role" : "badge-staff"
                          }`}
                        >
                          {ROLE_LABELS[u.role]}
                        </span>
                      </td>
                      <td>{u._count?.ownedTasks ?? 0}</td>
                      <td style={{ textAlign: "right" }}>
                        {u.id !== currentUser.id && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => removeUser(u)}
                          >
                            Hapus
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>

      {showForm && (
        <UserFormModal onClose={() => setShowForm(false)} onCreated={handleCreated} />
      )}
    </>
  );
}

function UserFormModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    department: "",
    role: ROLES.STAFF,
    password: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menambah personel.");
        setSaving(false);
        return;
      }
      onCreated(data.user);
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Tambah Personel</h3>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nama lengkap *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="mis. dr. Andi Wijaya"
              autoFocus
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Username *</label>
              <input
                value={form.username}
                onChange={(e) => set("username", e.target.value)}
                placeholder="mis. dr.andi"
                required
              />
            </div>
            <div className="field">
              <label>Departemen</label>
              <input
                value={form.department}
                onChange={(e) => set("department", e.target.value)}
                placeholder="mis. IGD"
              />
            </div>
          </div>
          <div className="field-row">
            <div className="field">
              <label>Peran</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                <option value={ROLES.STAFF}>{ROLE_LABELS.STAFF}</option>
                <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
              </select>
            </div>
            <div className="field">
              <label>Password * (min. 6)</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Tambah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
