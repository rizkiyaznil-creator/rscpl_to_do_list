"use client";

import { useState } from "react";

// Kelola kategori baku logbook (khusus admin).
export default function LogCategoryModal({ categories, onClose, onChanged }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/log-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Gagal menambah kategori.");
      else {
        setName("");
        onChanged();
      }
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c) {
    if (!confirm(`Hapus kategori "${c.name}"? Kegiatan lama tetap menyimpan nama kategorinya.`)) return;
    try {
      const res = await fetch(`/api/log-categories/${c.id}`, { method: "DELETE" });
      if (res.ok) onChanged();
      else alert((await res.json()).error || "Gagal menghapus.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Kategori Baku Logbook</h3>
        <p className="muted-sm" style={{ marginTop: 0 }}>
          Kategori ini muncul sebagai pilihan untuk semua personel. Pilihan{" "}
          <b>"Lainnya (tulis sendiri)"</b> selalu tersedia.
        </p>
        <ul className="cat-list">
          {categories.map((c) => (
            <li key={c.id}>
              <span>{c.name}</span>
              <button className="btn btn-sm btn-danger" onClick={() => remove(c)}>
                Hapus
              </button>
            </li>
          ))}
          {categories.length === 0 && <li className="muted-sm">Belum ada kategori.</li>}
        </ul>
        <form onSubmit={add} className="cat-add">
          {error && <div className="alert alert-error">{error}</div>}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kategori baru, mis. Supervisi/Visite"
            maxLength={60}
            required
          />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            + Tambah
          </button>
        </form>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
