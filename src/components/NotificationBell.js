"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { timeAgo, formatDate } from "@/lib/format";

const LEVEL_ICON = {
  overdue: "⚠️",
  today: "⏰",
  soon: "📅",
};

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ items: [], reminders: [], badge: 0, unreadCount: 0 });
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) setData(await res.json());
    } catch {
      /* abaikan error jaringan sementara */
    }
  }, []);

  // Muat saat mount + polling tiap 60 detik.
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

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
      // di dashboard; jika tidak, arahkan ke dashboard dengan query.
      const handled = window.dispatchEvent(
        new CustomEvent("open-task-detail", { detail: { taskId }, cancelable: true }),
      );
      // dispatchEvent mengembalikan false hanya bila preventDefault dipanggil.
      if (handled !== false) {
        router.push(`/dashboard?task=${taskId}`);
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
    openTask(n.taskId, n.id);
  }

  const { items, reminders, badge, unreadCount } = data;
  const hasContent = reminders.length > 0 || items.length > 0;

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
                      {n.type === "ASSIGNED"
                        ? "📌"
                        : n.type === "REGISTER"
                          ? "🆕"
                          : n.type === "RESET_REQUEST"
                            ? "🔑"
                            : "💬"}
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
