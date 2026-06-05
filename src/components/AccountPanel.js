"use client";

import { useState } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import PasswordField from "@/components/PasswordField";
import { ROLE_LABELS } from "@/lib/constants";
import { initials, formatDate } from "@/lib/format";

export default function AccountPanel({ currentUser, profile }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState(profile.email || "");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengganti password.");
        setSaving(false);
        return;
      }
      setSuccess("Password berhasil diganti.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail(e) {
    e.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    setSavingEmail(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Gagal menyimpan email.");
        setSavingEmail(false);
        return;
      }
      setEmailSuccess("Email berhasil disimpan.");
    } catch {
      setEmailError("Tidak dapat terhubung ke server.");
    } finally {
      setSavingEmail(false);
    }
  }

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <Link href="/dashboard" className="btn btn-sm btn-ghost">
            ← Kembali
          </Link>
          <h2 style={{ fontSize: 20 }}>Akun Saya</h2>
        </div>

        <div className="account-grid">
          {/* Profil */}
          <section className="card">
            <div className="owner-line" style={{ marginBottom: 14 }}>
              <span className="avatar" style={{ width: 48, height: 48, fontSize: 17 }}>
                {initials(profile.name)}
              </span>
              <div>
                <b style={{ fontSize: 16 }}>{profile.name}</b>
                <div>
                  <span
                    className={`badge ${
                      currentUser.role === "ADMIN" ? "badge-role" : "badge-staff"
                    }`}
                  >
                    {ROLE_LABELS[profile.role]}
                  </span>
                </div>
              </div>
            </div>
            <dl className="profile-list">
              <div>
                <dt>Username</dt>
                <dd>{profile.username}</dd>
              </div>
              <div>
                <dt>Departemen</dt>
                <dd>{profile.department || "—"}</dd>
              </div>
              <div>
                <dt>Jumlah tugas</dt>
                <dd>{profile._count?.ownedTasks ?? 0}</dd>
              </div>
              <div>
                <dt>Bergabung</dt>
                <dd>{formatDate(profile.createdAt)}</dd>
              </div>
            </dl>
            <p className="muted-sm" style={{ marginTop: 12 }}>
              Untuk mengubah nama, departemen, atau peran, hubungi admin.
            </p>
          </section>

          {/* Ganti password */}
          <section className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Ganti Password</h3>
            <form onSubmit={handleSubmit}>
              {error && <div className="alert alert-error">{error}</div>}
              {success && <div className="alert alert-success">{success}</div>}

              <PasswordField
                id="cur"
                label="Password lama"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <PasswordField
                id="new"
                label="Password baru (min. 6 karakter)"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <PasswordField
                id="confirm"
                label="Ulangi password baru"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Menyimpan..." : "Ganti Password"}
              </button>
            </form>
          </section>

          {/* Email untuk pengingat tugas */}
          <section className="card">
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Email Pengingat</h3>
            <p className="muted-sm" style={{ marginTop: 0 }}>
              Dipakai untuk mengirim pengingat tugas Anda (saat tugas dibuat, H-1,
              dan hari-H).
            </p>
            <form onSubmit={saveEmail}>
              {emailError && <div className="alert alert-error">{emailError}</div>}
              {emailSuccess && (
                <div className="alert alert-success">{emailSuccess}</div>
              )}
              <div className="field">
                <label htmlFor="email">Alamat email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="mis. nama@email.com"
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingEmail}>
                {savingEmail ? "Menyimpan..." : "Simpan Email"}
              </button>
            </form>
          </section>
        </div>
      </main>
    </>
  );
}
