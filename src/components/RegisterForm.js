"use client";

import { useState } from "react";
import Link from "next/link";
import PasswordField from "@/components/PasswordField";

export default function RegisterForm() {
  const [form, setForm] = useState({
    name: "",
    username: "",
    department: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Konfirmasi password tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          username: form.username,
          department: form.department,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mendaftar.");
        setLoading(false);
        return;
      }
      setDone(data.message || "Pendaftaran berhasil. Menunggu verifikasi admin.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setLoading(false);
    }
  }

  // Tampilan sukses: akun menunggu verifikasi admin.
  if (done) {
    return (
      <div>
        <div className="alert alert-success">{done}</div>
        <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}>
          Ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="name">Nama lengkap</label>
        <input
          id="name"
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="mis. Ns. Budi Santoso"
          autoFocus
          required
        />
      </div>
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={form.username}
          onChange={(e) => set("username", e.target.value)}
          placeholder="mis. ns.budi"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="department">Departemen / unit (opsional)</label>
        <input
          id="department"
          type="text"
          value={form.department}
          onChange={(e) => set("department", e.target.value)}
          placeholder="mis. IGD"
        />
      </div>
      <div className="field">
        <label htmlFor="email">Email (opsional, untuk pengingat tugas)</label>
        <input
          id="email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="mis. nama@email.com"
        />
      </div>
      <PasswordField
        id="password"
        label="Password (min. 6 karakter)"
        autoComplete="new-password"
        value={form.password}
        onChange={(e) => set("password", e.target.value)}
        required
      />
      <PasswordField
        id="confirm"
        label="Ulangi password"
        autoComplete="new-password"
        value={form.confirm}
        onChange={(e) => set("confirm", e.target.value)}
        required
      />
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={loading}
      >
        {loading ? "Memproses..." : "Daftar"}
      </button>
    </form>
  );
}
