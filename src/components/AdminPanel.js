"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PasswordField from "@/components/PasswordField";
import PositionSelect from "@/components/PositionSelect";
import { ROLES, ROLE_LABELS, USER_STATUS } from "@/lib/constants";
import { initials } from "@/lib/format";

// Kirim JSON & kembalikan { ok, data } tanpa melempar error.
async function sendJson(url, method, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Tidak dapat terhubung ke server." } };
  }
}

export default function AdminPanel({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [verifyUser, setVerifyUser] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [showWipe, setShowWipe] = useState(false);

  async function loadAll() {
    try {
      const [uRes, pRes] = await Promise.all([fetch("/api/users"), fetch("/api/positions")]);
      const [uData, pData] = await Promise.all([uRes.json(), pRes.json()]);
      if (uRes.ok) setUsers(uData.users || []);
      else setError(uData.error || "Gagal memuat data.");
      if (pRes.ok) setPositions(pData.positions || []);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Setelah ada perubahan personel, muat ulang agar status "terisi" jabatan ikut segar.
  function afterChange() {
    setShowForm(false);
    setEditUser(null);
    setVerifyUser(null);
    loadAll();
  }

  async function removeUser(u) {
    if (
      !confirm(
        `Hapus akun "${u.name}"? Semua tugas miliknya (${u._count?.ownedTasks ?? 0}) akan ikut terhapus.`,
      )
    )
      return;
    const { ok, data } = await sendJson(`/api/users/${u.id}`, "DELETE");
    if (ok) afterChange();
    else alert(data.error || "Gagal menghapus.");
  }

  // Tolak pendaftar: hapus akunnya (belum punya data sehingga aman dihapus).
  async function rejectUser(u) {
    if (!confirm(`Tolak & hapus pendaftaran "${u.name}" (@${u.username})?`)) return;
    const { ok, data } = await sendJson(`/api/users/${u.id}`, "DELETE");
    if (ok) afterChange();
    else alert(data.error || "Gagal menolak.");
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
          <Link href="/admin/jabatan" className="btn">
            🏛 Kelola Jabatan
          </Link>
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
                            {u.email ? ` · ${u.email}` : ""}
                          </small>
                        </div>
                      </div>
                      <div className="pending-actions">
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => setVerifyUser(u)}
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
                    <th>Jabatan</th>
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
                      <td>
                        {u.position ? (
                          <>
                            {u.position.name}
                            <div className="muted-sm">{u.position.bidang}</div>
                          </>
                        ) : (
                          <span className="muted-sm">Belum ditetapkan</span>
                        )}
                      </td>
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
                        <div className="row-actions">
                          <button className="btn btn-sm" onClick={() => setEditUser(u)}>
                            Ubah
                          </button>
                          <button className="btn btn-sm" onClick={() => setResetUser(u)}>
                            Reset Password
                          </button>
                          {u.id !== currentUser.id && (
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => removeUser(u)}
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Zona berbahaya: mulai ulang data personel sesuai SOTK baru */}
            <div className="danger-zone">
              <div>
                <b>Hapus semua personel lama</b>
                <p className="muted-sm" style={{ margin: "4px 0 0" }}>
                  Menghapus semua akun <b>kecuali admin</b> beserta seluruh tugas,
                  notifikasi, dan riwayat aktivitas. Daftar jabatan tetap. Unduh
                  arsip laporan PDF/CSV lebih dulu.
                </p>
              </div>
              <button className="btn btn-danger" onClick={() => setShowWipe(true)}>
                Hapus semua personel lama
              </button>
            </div>
          </>
        )}
      </main>

      {showForm && (
        <UserFormModal
          positions={positions}
          onClose={() => setShowForm(false)}
          onSaved={afterChange}
        />
      )}

      {editUser && (
        <EditUserModal
          user={editUser}
          positions={positions}
          isSelf={editUser.id === currentUser.id}
          onClose={() => setEditUser(null)}
          onSaved={afterChange}
        />
      )}

      {verifyUser && (
        <VerifyModal
          user={verifyUser}
          positions={positions}
          onClose={() => setVerifyUser(null)}
          onSaved={afterChange}
        />
      )}

      {resetUser && (
        <ResetPasswordModal user={resetUser} onClose={() => setResetUser(null)} />
      )}

      {showWipe && (
        <WipeModal
          onClose={() => setShowWipe(false)}
          onDone={() => {
            setShowWipe(false);
            loadAll();
          }}
        />
      )}
    </>
  );
}

function UserFormModal({ positions, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    positionId: "",
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
    const { ok, data } = await sendJson("/api/users", "POST", form);
    if (!ok) {
      setError(data.error || "Gagal menambah personel.");
      setSaving(false);
      return;
    }
    onSaved();
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
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
              />
            </div>
            <div className="field">
              <label>Email (untuk pengingat)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="mis. nama@email.com"
              />
            </div>
          </div>
          <div className="field">
            <label htmlFor="new-user-position">Jabatan</label>
            <PositionSelect
              id="new-user-position"
              positions={positions}
              value={form.positionId}
              onChange={(v) => set("positionId", v)}
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Peran aplikasi</label>
              <select value={form.role} onChange={(e) => set("role", e.target.value)}>
                <option value={ROLES.STAFF}>{ROLE_LABELS.STAFF}</option>
                <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
              </select>
            </div>
            <PasswordField
              id="new-user-password"
              label="Password * (min. 6)"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              required
            />
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

// Ubah data personel: nama, email, jabatan, peran.
function EditUserModal({ user, positions, isSelf, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: user.name,
    email: user.email || "",
    positionId: user.position?.id ?? "",
    role: user.role,
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
    const { ok, data } = await sendJson(`/api/users/${user.id}`, "PATCH", form);
    if (!ok) {
      setError(data.error || "Gagal menyimpan perubahan.");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Ubah Personel</h3>
        <p className="muted-sm" style={{ marginTop: 0 }}>@{user.username}</p>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nama lengkap *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Email (untuk pengingat)</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="mis. nama@email.com"
            />
          </div>
          <div className="field">
            <label htmlFor="edit-user-position">Jabatan</label>
            <PositionSelect
              id="edit-user-position"
              positions={positions}
              value={form.positionId}
              onChange={(v) => set("positionId", v)}
              userId={user.id}
            />
          </div>
          <div className="field">
            <label>Peran aplikasi</label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              disabled={isSelf}
            >
              <option value={ROLES.STAFF}>{ROLE_LABELS.STAFF}</option>
              <option value={ROLES.ADMIN}>{ROLE_LABELS.ADMIN}</option>
            </select>
            {isSelf && (
              <small className="muted-sm">Peran akun Anda sendiri tidak bisa diubah di sini.</small>
            )}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Verifikasi pendaftar sekaligus menetapkan jabatannya.
function VerifyModal({ user, positions, onClose, onSaved }) {
  const [positionId, setPositionId] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const { ok, data } = await sendJson(`/api/users/${user.id}`, "PATCH", {
      status: USER_STATUS.ACTIVE,
      positionId,
    });
    if (!ok) {
      setError(data.error || "Gagal memverifikasi.");
      setSaving(false);
      return;
    }
    onSaved();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Verifikasi Pendaftar</h3>
        <p className="muted-sm" style={{ marginTop: 0 }}>
          <b>{user.name}</b> (@{user.username})
        </p>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="verify-position">Tetapkan jabatan</label>
            <PositionSelect
              id="verify-position"
              positions={positions}
              value={positionId}
              onChange={setPositionId}
            />
            <small className="muted-sm">
              Boleh dikosongkan dulu, lalu diatur nanti lewat tombol "Ubah".
            </small>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Memproses..." : "✓ Verifikasi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Konfirmasi hapus semua personel lama (ketik HAPUS).
function WipeModal({ onClose, onDone }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const { ok, data } = await sendJson("/api/admin/reset-personnel", "POST", {
      confirm: text.trim(),
    });
    if (!ok) {
      setError(data.error || "Gagal menghapus data.");
      setSaving(false);
      return;
    }
    const d = data.deleted;
    alert(`Selesai. Terhapus: ${d.users} personel, ${d.tasks} tugas.`);
    onDone();
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>⚠️ Hapus semua personel lama</h3>
        <div className="alert alert-error">
          Tindakan ini <b>permanen</b>: semua akun selain admin, seluruh tugas,
          notifikasi, dan riwayat aktivitas akan dihapus dan <b>tidak bisa
          dikembalikan</b>.
        </div>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label htmlFor="wipe-confirm">
              Ketik <b>HAPUS</b> untuk melanjutkan
            </label>
            <input
              id="wipe-confirm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-danger"
              disabled={saving || text.trim() !== "HAPUS"}
            >
              {saving ? "Menghapus..." : "Hapus permanen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal reset password oleh admin. Admin menetapkan/menghasilkan password BARU
// (password lama tidak bisa dilihat karena disimpan sebagai hash) lalu password
// baru itu ditampilkan untuk diberikan ke personel.
function ResetPasswordModal({ user, onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  // Password acak mudah dibaca (tanpa karakter ambigu seperti l/1/O/0).
  function generate() {
    const chars = "abcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 8; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setPassword(p);
  }

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password minimal 6 karakter.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengatur ulang password.");
        setSaving(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Reset Password</h3>
        <p style={{ marginTop: 0, color: "var(--text-muted)", fontSize: 13.5 }}>
          Akun: <b>{user.name}</b> (@{user.username})
        </p>

        {done ? (
          <div>
            <div className="alert alert-success">
              Password berhasil diatur ulang. Berikan password baru ini kepada personel:
            </div>
            <div className="reset-password-box">{password}</div>
            <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
              Minta personel segera menggantinya sendiri lewat menu “Akun Saya”
              setelah berhasil masuk.
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={onClose}>
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            {error && <div className="alert alert-error">{error}</div>}
            <PasswordField
              id="reset-password"
              label="Password baru (min. 6 karakter)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="ketik manual atau buat otomatis"
              autoFocus
              defaultShow
            />
            <button type="button" className="btn btn-sm" onClick={generate}>
              🎲 Buatkan otomatis
            </button>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose} disabled={saving}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Menyimpan..." : "Atur ulang"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
