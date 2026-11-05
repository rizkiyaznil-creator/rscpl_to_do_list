"use client";

import { useState, useEffect } from "react";

// Tombol "Install aplikasi" (PWA).
//  - Android / Chrome / Edge: memunculkan dialog install bawaan browser.
//  - iPhone / iPad (Safari): menampilkan petunjuk "Tambah ke Layar Utama",
//    karena iOS tidak menyediakan dialog install otomatis.
// Tombol disembunyikan bila aplikasi sudah dibuka sebagai aplikasi terpasang
// atau browser tidak mendukung install.
//
// Event `beforeinstallprompt` ditangkap sedini mungkin oleh skrip di layout
// (window.__installPrompt), karena bisa muncul sebelum komponen ini dimuat.

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

// Ikon "Bagikan" ala iOS.
function ShareIcon() {
  return (
    <svg className="ios-share" viewBox="0 0 24 24" width="18" height="18" aria-label="ikon Bagikan">
      <path
        d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DISMISS_KEY = "installBannerDismissed";

// variant: "icon" (top bar desktop), "banner" (spanduk di bawah menu, HP),
//          "block" (lebar penuh, halaman login), "hero" (halaman profil)
export default function InstallApp({ variant = "block" }) {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (variant === "banner") {
      try {
        setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
      } catch {
        /* penyimpanan tidak tersedia: tetap tampilkan */
      }
    }
    setIos(isIos());
    const sync = () => setPrompt(window.__installPrompt || null);
    sync();
    window.addEventListener("installprompt-ready", sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      window.removeEventListener("installprompt-ready", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  if ((!prompt && !ios) || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* abaikan */
    }
  }

  async function install() {
    if (!prompt) {
      setShowHelp(true);
      return;
    }
    prompt.prompt();
    await prompt.userChoice.catch(() => null);
    // Event hanya bisa dipakai sekali.
    window.__installPrompt = null;
    setPrompt(null);
  }

  const label = "Install aplikasi";
  return (
    <>
      {variant === "icon" ? (
        <button className="notif-btn install-btn" onClick={install} title={label} aria-label={label}>
          📲
        </button>
      ) : variant === "banner" ? (
        <div className="install-banner">
          <span>📲 Pasang aplikasi di HP agar lebih cepat dibuka</span>
          <button className="btn btn-sm btn-primary" onClick={install}>
            Install
          </button>
          <button className="icon-btn" onClick={dismiss} title="Tutup" aria-label="Tutup">
            ✕
          </button>
        </div>
      ) : (
        <button
          className={`btn ${variant === "hero" ? "btn-lg install-hero" : "install-block"}`}
          onClick={install}
        >
          📲 {label}
        </button>
      )}

      {showHelp && (
        <div className="modal-overlay" onClick={() => setShowHelp(false)}>
          <div className="modal install-help" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>📲 Install di iPhone / iPad</h3>
            <ol>
              <li>
                Buka aplikasi ini di <b>Safari</b>.
              </li>
              <li>
                Ketuk tombol <b>Bagikan</b> <ShareIcon /> (kotak dengan panah ke atas) di bagian bawah
                layar.
              </li>
              <li>
                Gulir lalu pilih <b>Tambah ke Layar Utama</b> (Add to Home Screen).
              </li>
              <li>
                Ketuk <b>Tambah</b>. Ikon RS CPL USU akan muncul di layar utama.
              </li>
            </ol>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => setShowHelp(false)}>
                Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
