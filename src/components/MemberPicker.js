"use client";

import { useState, useEffect } from "react";

// Pemilih personel lintas bidang untuk tugas bersama. Menampilkan apakah
// orang tsb langsung masuk atau perlu persetujuan bila diajak.
//   value: array id terpilih; onChange(ids); exclude: id yang tidak ditampilkan.
let cache = null;
export async function loadDirectory() {
  if (cache) return cache;
  const res = await fetch("/api/users/directory");
  const d = await res.json();
  if (!res.ok) throw new Error(d.error || "Gagal memuat daftar personel.");
  cache = d.users || [];
  return cache;
}

export const MODE_LABEL = { direct: "langsung", approval: "perlu persetujuan" };

export default function MemberPicker({ value, onChange, exclude = [] }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadDirectory().then(setUsers).catch((e) => setError(e.message));
  }, []);

  const term = q.trim().toLowerCase();
  const list = users.filter(
    (u) =>
      !exclude.includes(u.id) &&
      (!term ||
        `${u.name} ${u.position?.name || ""} ${u.position?.bidang || ""}`.toLowerCase().includes(term)),
  );
  const selected = users.filter((u) => value.includes(u.id));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div className="member-picker">
      {selected.length > 0 && (
        <div className="mp-chips">
          {selected.map((u) => (
            <span key={u.id} className={`mp-chip ${u.mode}`}>
              {u.name}
              <small>{MODE_LABEL[u.mode]}</small>
              <button type="button" onClick={() => toggle(u.id)} aria-label={`Hapus ${u.name}`}>
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Cari nama, jabatan, atau bidang..."
      />
      {error && <div className="muted-sm">{error}</div>}
      <div className="mp-list">
        {list.slice(0, 60).map((u) => (
          <label key={u.id} className="mp-item">
            <input type="checkbox" checked={value.includes(u.id)} onChange={() => toggle(u.id)} />
            <span className="mp-name">
              <b>{u.name}</b>
              <small>
                {u.position ? `${u.position.name} · ${u.position.bidang}` : "Belum ada jabatan"}
              </small>
            </span>
            <span className={`mp-mode ${u.mode}`}>{MODE_LABEL[u.mode]}</span>
          </label>
        ))}
        {list.length === 0 && <div className="muted-sm" style={{ padding: 8 }}>Tidak ada yang cocok.</div>}
      </div>
    </div>
  );
}
