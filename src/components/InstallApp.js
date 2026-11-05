"use client";

import { useState, useEffect } from "react";

// Tombol "Install aplikasi" (PWA). Selalu tampil kecuali aplikasi sudah dibuka
// sebagai aplikasi terpasang.
//  - Bila browser sudah menawarkan dialog install (Chrome/Edge/Android), tombol
//    memunculkan dialog bawaan tsb.
//  - Bila belum (iPhone/iPad, Safari Mac, atau Chrome yang belum menawarkan
//    karena syarat interaksi / aplikasi sudah terpasang), tombol menampilkan
//    petunjuk install sesuai perangkat & browser.
//
// Event `beforeinstallprompt` ditangkap sedini mungkin oleh skrip di layout
// (window.__installPrompt), karena bisa muncul sebelum komponen ini dimuat.

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true
  );
}

function detectPlatform() {
  const ua = window.navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/i.test(ua)) return /SamsungBrowser/i.test(ua) ? "samsung" : "android";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Edg\//.test(ua)) return "edge";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Macintosh/.test(ua) && /Safari\//.test(ua)) return "safari-mac";
  return "other";
}

// Judul & langkah install manual per perangkat/browser.
const HELP = {
  ios: {
    title: "Install di iPhone / iPad",
    steps: [
      <>Buka aplikasi ini di <b>Safari</b>.</>,
      <>Ketuk tombol <b>Bagikan</b> <ShareIcon /> (kotak dengan panah ke atas) di bagian bawah layar.</>,
      <>Gulir lalu pilih <b>Tambah ke Layar Utama</b> (Add to Home Screen).</>,
      <>Ketuk <b>Tambah</b>. Ikon RS CPL USU akan muncul di layar utama.</>,
    ],
  },
  android: {
    title: "Install di HP Android (Chrome)",
    steps: [
      <>Ketuk menu <b>⋮</b> di kanan atas Chrome.</>,
      <>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</>,
      <>Ketuk <b>Instal</b>. Ikon RS CPL USU akan muncul di layar utama.</>,
    ],
  },
  samsung: {
    title: "Install di Samsung Internet",
    steps: [
      <>Ketuk menu <b>≡</b> di bagian bawah.</>,
      <>Pilih <b>Tambahkan halaman ke</b> → <b>Layar Utama</b>.</>,
      <>Ketuk <b>Tambahkan</b>.</>,
    ],
  },
  chrome: {
    title: "Install di komputer (Chrome)",
    steps: [
      <>Klik ikon <b>Instal</b> (layar dengan panah ke bawah) di ujung kanan kolom alamat.</>,
      <>Bila ikon tidak ada: klik menu <b>⋮</b> → <b>Transmisikan, simpan, dan bagikan</b> → <b>Instal halaman sebagai aplikasi…</b></>,
      <>Klik <b>Instal</b>. Aplikasi akan muncul di Launchpad / menu Start.</>,
    ],
  },
  edge: {
    title: "Install di komputer (Microsoft Edge)",
    steps: [
      <>Klik menu <b>…</b> di kanan atas.</>,
      <>Pilih <b>Aplikasi</b> → <b>Instal situs ini sebagai aplikasi</b>.</>,
      <>Klik <b>Instal</b>.</>,
    ],
  },
  "safari-mac": {
    title: "Install di Mac (Safari)",
    steps: [
      <>Klik menu <b>File</b> (Berkas) di bilah menu atas.</>,
      <>Pilih <b>Tambahkan ke Dock</b> (Add to Dock), lalu klik <b>Tambahkan</b>.</>,
    ],
  },
  firefox: {
    title: "Browser belum mendukung install",
    steps: [
      <>Firefox belum mendukung install aplikasi web.</>,
      <>Buka alamat ini di <b>Google Chrome</b> atau <b>Microsoft Edge</b> (komputer/Android), atau <b>Safari</b> (iPhone/Mac), lalu ketuk tombol Install lagi.</>,
    ],
  },
  other: {
    title: "Install aplikasi",
    steps: [
      <>Buka menu browser Anda, lalu cari pilihan <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</>,
      <>Bila tidak ada, buka alamat ini di <b>Google Chrome</b>, <b>Microsoft Edge</b>, atau <b>Safari</b>.</>,
    ],
  },
};

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
  const [platform, setPlatform] = useState(null); // null = belum diketahui / sudah terpasang
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
    setPlatform(detectPlatform());
    const sync = () => setPrompt(window.__installPrompt || null);
    sync();
    window.addEventListener("installprompt-ready", sync);
    window.addEventListener("appinstalled", sync);
    return () => {
      window.removeEventListener("installprompt-ready", sync);
      window.removeEventListener("appinstalled", sync);
    };
  }, []);

  if (!platform || dismissed) return null;
  const help = HELP[platform] || HELP.other;

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
            <h3 style={{ marginTop: 0 }}>📲 {help.title}</h3>
            <ol>
              {help.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="muted-sm" style={{ margin: "0 0 8px" }}>
              Sudah pernah di-install? Buka aplikasi <b>RS CPL USU</b> dari layar utama / daftar
              aplikasi.
            </p>
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
