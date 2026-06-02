"use client";

import { useState } from "react";
import Link from "next/link";

export default function ForgotPasswordForm() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal mengirim permintaan.");
        setLoading(false);
        return;
      }
      setDone(data.message || "Permintaan Anda telah dikirim ke admin.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div>
        <div className="alert alert-success">{done}</div>
        <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}>
          Kembali ke halaman masuk
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="username">Username Anda</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="mis. ns.budi"
          autoFocus
          required
        />
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%" }}
        disabled={loading}
      >
        {loading ? "Mengirim..." : "Kirim permintaan ke admin"}
      </button>
    </form>
  );
}
