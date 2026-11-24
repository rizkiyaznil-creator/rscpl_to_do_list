"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { timeAgo, formatDate } from "@/lib/format";
import { useActivePolling } from "@/lib/useActivePolling";

// Ikon per jenis notifikasi tersimpan (bawaan: 💬 komentar).
const NOTIF_ICON = {
  ASSIGNED: "📌",
  REGISTER: "🆕",
  RESET_REQUEST: "🔑",
  LOGBOOK_APPROVED: "✅",
  LOGBOOK_REVISION: "↩️",
  LOGBOOK_FIXED: "🛠",
  EXTENSION_REQUEST: "📅",
  EXTENSION_APPROVED: "✅",
  EXTENSION_REJECTED: "✖️",
  DUE_CHANGED: "🗓",
  SHARED_INVITE: "📨",
  SHARED_ADDED: "👥",
  SHARED_ACCEPTED: "🤝",
  SHARED_DECLINED: "✖️",
  SHARED_REMOVED: "➖",
  KS_SUBMITTED: "🤝",
  KS_VERIFIED: "✅",
  KS_RETURNED: "↩️",
};

const LEVEL_ICON = {
  overdue: "⚠️",
  today: "⏰",
  soon: "📅",
};

// onMeta(meta): dipanggil setiap data dimuat, mis. { kerjasama: true } untuk
// menampilkan menu Kerjasama di TopBar.
export default function NotificationBell({ onMeta }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], reminders: [], logbook: null, kerjasama: null, badge: 0, unreadCount: 0 });
  const onMetaRef = useRef(onMeta);
  onMetaRef.current = onMeta;
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.menu) onMetaRef.current?.(d.menu);
      }
    } catch {
      /* abaikan error jaringan sementara */
    }
  }, []);

  // Muat saat mount, lalu tiap 60 detik selama tab terlihat & pengguna aktif
  // (diam ≥ 5 menit atau tab tersembunyi = jeda, agar database Neon bisa tidur).
  // Begitu tab dibuka lagi / pengguna kembali berinteraksi, langsung dimuat ulang.
  useActivePolling(load, { intervalMs: 60_000, idleMs: 5 * 60_000 });

  // Tutup dropdown saat klik di luar.
  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) await load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  async function openTask(taskId, notifId) {
    if (notifId) {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifId }),
      });
    }
    setOpen(false);
    load();
    if (taskId) {
      // Board mendengarkan event ini untuk membuka modal detail bila sedang
      // di halaman Tugas; jika tidak, arahkan ke halaman Tugas dengan query.
      const handled = window.dispatchEvent(
        new CustomEvent("open-task-detail", { detail: { taskId }, cancelable: true }),
      );
      // dispatchEvent mengembalikan false hanya bila preventDefault dipanggil.
      if (handled !== false) {
        router.push(`/tugas?task=${taskId}`);
      }
    }
  }

  async function markRead(notifId) {
    if (!notifId) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notifId }),
    });
  }

  // Notifikasi pendaftaran / lupa-password mengarahkan admin ke Kelola Personel.
  async function handleNotifClick(n) {
    if (n.type === "REGISTER" || n.type === "RESET_REQUEST") {
      await markRead(n.id);
      setOpen(false);
      load();
      router.push("/admin");
      return;
    }
    // Notifikasi logbook (disetujui, komentar, dikembalikan, diperbaiki).
    if (n.link || n.type === "LOGBOOK_APPROVED") {
      await markRead(n.id);
      setOpen(false);
      load();
      const target = n.link || "/logbook";
      // Halaman Logbook/Kerjasama membaca query (?user=&week= / ?id=) saat dimuat,
      // jadi muat ulang bila sedang berada di halaman yang sama.
      if (window.location.pathname === target.split("?")[0]) window.location.assign(target);
      else router.push(target);
      return;
    }
    openTask(n.taskId, n.id);
  }

  const { items, reminders, logbook, kerjasama, badge, unreadCount } = data;
  const ksCount = kerjasama ? kerjasama.alarms.length + (kerjasama.pending ? 1 : 0) : 0;
  const hasContent = Boolean(logbook) || reminders.length > 0 || items.length > 0 || ksCount > 0;
  const goKs = (href) => {
    setOpen(false);
    if (window.location.pathname === "/kerjasama") window.location.assign(href);
    else router.push(href);
  };

  return (
    <div className="notif" ref={ref}>
      <button
        className="notif-btn"
        onClick={toggle}
        aria-label="Notifikasi"
        title="Notifikasi"
      >
        🔔
        {badge > 0 && <span className="notif-badge">{badge > 99 ? "99+" : badge}</span>}
      </button>

      {open && (
        <div className="notif-panel">
          <div className="notif-head">
            <b>Notifikasi</b>
            {unreadCount > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={markAllRead}>
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="notif-body">
            {/* Pengingat logbook (live, Senin–Jumat) */}
            {logbook && (
              <div className="notif-group">
                <div className="notif-group-title">Logbook</div>
                <button
                  className="notif-item reminder today"
                  onClick={() => {
                    setOpen(false);
                    router.push("/logbook");
                  }}
                >
                  <span className="notif-icon">📝</span>
                  <span className="notif-text">
                    <b>{logbook.label}</b>
                    <small>Ketuk untuk mengisi kegiatan hari ini</small>
                  </span>
                </button>
              </div>
            )}

            {/* Pengingat tenggat (live) */}
            {reminders.length > 0 && (
              <div className="notif-group">
                <div className="notif-group-title">Pengingat tenggat</div>
                {reminders.map((r) => (
                  <button
                    key={`r-${r.taskId}`}
                    className={`notif-item reminder ${r.level}`}
                    onClick={() => openTask(r.taskId)}
                  >
                    <span className="notif-icon">{LEVEL_ICON[r.level]}</span>
                    <span className="notif-text">
                      <b>{r.title}</b>
                      <small>
                        {r.label} · {formatDate(r.dueDate)}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Alarm kerjasama (unit Kerja Sama) */}
            {ksCount > 0 && (
              <div className="notif-group">
                <div className="notif-group-title">Kerjasama</div>
                {kerjasama.pending > 0 && (
                  <button className="notif-item reminder soon" onClick={() => goKs("/kerjasama?filter=MENUNGGU")}>
                    <span className="notif-icon">🔎</span>
                    <span className="notif-text">
                      <b>{kerjasama.pending} data kerjasama menunggu verifikasi</b>
                      <small>Ketuk untuk memverifikasi</small>
                    </span>
                  </button>
                )}
                {kerjasama.alarms.slice(0, 6).map((a, i) => (
                  <button
                    key={`ks-${a.id}-${i}`}
                    className={`notif-item reminder ${a.level === "danger" ? "overdue" : "soon"}`}
                    onClick={() => goKs(`/kerjasama?id=${a.id}`)}
                  >
                    <span className="notif-icon">{a.level === "danger" ? "⚠️" : "🤝"}</span>
                    <span className="notif-text">
                      <b>{a.mitra}</b>
                      <small>{a.label}</small>
                    </span>
                  </button>
                ))}
                {kerjasama.alarms.length > 6 && (
                  <button className="notif-item reminder" onClick={() => goKs("/kerjasama?filter=ALARM")}>
                    <span className="notif-icon">➕</span>
                    <span className="notif-text">
                      <b>{kerjasama.alarms.length - 6} alarm kerjasama lainnya</b>
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Notifikasi event tersimpan */}
            {items.length > 0 && (
              <div className="notif-group">
                <div className="notif-group-title">Aktivitas</div>
                {items.map((n) => (
                  <button
                    key={n.id}
                    className={`notif-item ${n.read ? "" : "unread"}`}
                    onClick={() => handleNotifClick(n)}
                  >
                    <span className="notif-icon">
                      {NOTIF_ICON[n.type] || "💬"}
                    </span>
                    <span className="notif-text">
                      <span>{n.message}</span>
                      <small>{timeAgo(n.createdAt)}</small>
                    </span>
                    {!n.read && <span className="unread-dot" />}
                  </button>
                ))}
              </div>
            )}

            {!hasContent && (
              <div className="notif-empty">
                <div style={{ fontSize: 28 }}>🎉</div>
                Tidak ada notifikasi atau tenggat mendesak.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
