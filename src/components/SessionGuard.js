"use client";

import { useEffect, useState } from "react";

// Penjaga sesi: bila server menjawab 401 (sesi login berakhir) untuk permintaan
// ke /api/*, tampilkan pemberitahuan dengan tombol "Login ulang" yang membuka
// halaman login di TAB BARU — sehingga isian form di halaman ini tidak hilang.
// Setelah login di tab baru lalu kembali ke tab ini, sesi dicek ulang dan
// pemberitahuan hilang sendiri; pengguna cukup mengulang klik Simpan/Tambah.
// Permintaan /api/auth/* (login, daftar, lupa password, cek sesi) tidak dipantau.
export default function SessionGuard() {
  const [expired, setExpired] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (window.__sessionGuard) return undefined;
    window.__sessionGuard = true;
    const original = window.fetch;
    window.fetch = async (...args) => {
      const res = await original(...args);
      try {
        const url = new URL(typeof args[0] === "string" ? args[0] : args[0]?.url || "", window.location.href);
        if (res.status === 401 && url.origin === window.location.origin && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/auth/")) {
          window.dispatchEvent(new Event("session-expired"));
        }
      } catch {
        /* URL tidak dikenali — abaikan */
      }
      return res;
    };
    return () => {
      window.fetch = original;
      window.__sessionGuard = false;
    };
  }, []);

  useEffect(() => {
    const onExpired = () => {
      setRestored(false);
      setExpired(true);
    };
    window.addEventListener("session-expired", onExpired);
    return () => window.removeEventListener("session-expired", onExpired);
  }, []);

  // Saat kembali ke tab ini (mis. setelah login di tab baru), cek apakah sesi sudah pulih.
  useEffect(() => {
    if (!expired) return undefined;
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (res.ok) {
          setExpired(false);
          setRestored(true);
          setTimeout(() => setRestored(false), 6000);
        }
      } catch {
        /* jaringan putus — coba lagi saat fokus berikutnya */
      }
    };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [expired]);

  if (restored) {
    return (
      <div className="session-guard ok" role="status">
        ✓ Anda sudah login kembali. Silakan ulangi menyimpan (klik Simpan/Tambah lagi).
      </div>
    );
  }
  if (!expired) return null;
  return (
    <div className="session-guard" role="alert">
      <span>
        ⚠ <b>Sesi login Anda telah berakhir.</b> Isian di halaman ini tidak hilang — login ulang di tab baru, lalu kembali ke
        tab ini dan ulangi menyimpan.
      </span>
      <a className="btn btn-sm btn-primary" href="/login?next=/dashboard" target="_blank" rel="noopener">
        Login ulang
      </a>
    </div>
  );
}
