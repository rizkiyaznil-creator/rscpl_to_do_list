"use client";

import { useState } from "react";
import { initials, timeAgo } from "@/lib/format";

// Utas komentar logbook: per kegiatan (entryId) atau per minggu (entryId null).
// Siapa pun yang dapat membuka logbook boleh berkomentar; pemilik membalas.
export default function LogComments({ comments, ownerId, ownerName, week, entryId = null, perms, onChanged }) {
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    setError("");
    try {
      const res = await fetch("/api/logbook/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: ownerId, week, entryId, body: text }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal mengirim komentar.");
      } else {
        setText("");
        onChanged();
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setPosting(false);
    }
  }

  async function remove(c) {
    if (!confirm("Hapus komentar ini?")) return;
    try {
      const res = await fetch(`/api/logbook/comments/${c.id}`, { method: "DELETE" });
      const d = await res.json();
      if (res.ok) onChanged();
      else alert(d.error || "Gagal menghapus komentar.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  const placeholder = perms.isOwner
    ? "Tulis balasan / tanggapan..."
    : `Tulis komentar untuk ${ownerName || "personel"}...`;

  return (
    <div className="log-comments">
      {comments.length > 0 && (
        <div className="comments">
          {comments.map((c) => (
            <div key={c.id} className={`comment ${c.kind === "REVISION" ? "is-revision" : ""}`}>
              <span className="avatar sm">{initials(c.author?.name)}</span>
              <div className="comment-body">
                <div className="comment-head">
                  <b>{c.author?.name || "Pengguna"}</b>
                  {c.author?.position?.name && <span className="comment-pos">{c.author.position.name}</span>}
                  <small>{timeAgo(c.createdAt)}</small>
                  {(perms.isAdmin || c.author?.id === perms.viewerId) && (
                    <button className="icon-btn" title="Hapus komentar" onClick={() => remove(c)}>
                      ✕
                    </button>
                  )}
                </div>
                {c.kind === "REVISION" && <div className="revision-tag">↩️ Dikembalikan untuk perbaikan</div>}
                <p>{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      <form onSubmit={send} className="inline-form">
        <textarea
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={2000}
        />
        <button className="btn btn-sm btn-primary" disabled={posting || !text.trim()}>
          {posting ? "..." : "Kirim"}
        </button>
      </form>
    </div>
  );
}
