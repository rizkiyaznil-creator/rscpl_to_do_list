"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { withDepth } from "@/components/PositionSelect";
import { POSITION_LEVELS, POSITION_LEVEL_LABELS } from "@/lib/constants";

const MULTI_LEVELS = ["ANGGOTA", "STAF"];

// Halaman admin untuk mengelola daftar jabatan (SOTK) dalam bentuk pohon.
export default function PositionManager({ currentUser }) {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | {} (baru) | position

  async function load() {
    try {
      const res = await fetch("/api/positions");
      const data = await res.json();
      if (res.ok) setPositions(data.positions || []);
      else setError(data.error || "Gagal memuat jabatan.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function remove(p) {
    if (!confirm(`Hapus jabatan "${p.name}"?`)) return;
    try {
      const res = await fetch(`/api/positions/${p.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) load();
      else alert(data.error || "Gagal menghapus.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    }
  }

  const rows = withDepth(positions);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <Link href="/admin" className="btn btn-sm btn-ghost">
            ← Kelola Personel
          </Link>
          <h2 style={{ fontSize: 20 }}>Kelola Jabatan</h2>
          <span className="count">{positions.length} jabatan</span>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + Tambah Jabatan
          </button>
        </div>
        <p className="muted-sm" style={{ marginTop: -4 }}>
          Struktur sesuai SOTK. Jabatan bertanda <b>1 orang</b> hanya boleh dipegang
          satu personel. Pemegang jabatan diatur di menu Kelola Personel.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="empty">Memuat data...</div>
        ) : (
          <div className="table-wrap">
            <table className="table position-table">
              <thead>
                <tr>
                  <th>Jabatan</th>
                  <th>Level</th>
                  <th>Bidang</th>
                  <th>Pemegang</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="pos-name" style={{ paddingLeft: p.depth * 18 }}>
                        {p.depth > 0 && <span className="pos-branch">└</span>}
                        <b>{p.name}</b>
                        {p.single && <span className="badge badge-staff">1 orang</span>}
                      </div>
                    </td>
                    <td className="muted-sm">{POSITION_LEVEL_LABELS[p.level] || p.level}</td>
                    <td className="muted-sm">{p.bidang || "—"}</td>
                    <td>
                      {p.users.length === 0 ? (
                        <span className="muted-sm">{p.single ? "Kosong" : "—"}</span>
                      ) : (
                        p.users.map((u) => u.name).join(", ")
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setEditing(p)}>
                          Ubah
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => remove(p)}
                          disabled={p.users.length > 0 || p._count.children > 0}
                          title={
                            p.users.length > 0 || p._count.children > 0
                              ? "Masih punya pemegang/bawahan"
                              : "Hapus jabatan"
                          }
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {editing && (
        <PositionFormModal
          position={editing.id ? editing : null}
          positions={positions}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function PositionFormModal({ position, positions, onClose, onSaved }) {
  const isNew = !position;
  const [form, setForm] = useState({
    name: position?.name || "",
    level: position?.level || "STAF",
    parentId: position?.parentId ?? "",
    bidang: position?.bidang || "",
    single: position ? position.single : false,
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set(key, value) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      // Saat menambah, sesuaikan aturan "1 orang" mengikuti level bawaannya.
      if (isNew && key === "level") next.single = !MULTI_LEVELS.includes(value);
      return next;
    });
  }

  // Jabatan ini & bawahannya tidak boleh dipilih sebagai atasan.
  const blocked = new Set();
  if (position) {
    blocked.add(position.id);
    let added = true;
    while (added) {
      added = false;
      for (const p of positions) {
        if (p.parentId && blocked.has(p.parentId) && !blocked.has(p.id)) {
          blocked.add(p.id);
          added = true;
        }
      }
    }
  }
  const parentOptions = withDepth(positions).filter((p) => !blocked.has(p.id));

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch(isNew ? "/api/positions" : `/api/positions/${position.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, parentId: form.parentId || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? "Tambah Jabatan" : "Ubah Jabatan"}</h3>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nama jabatan *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="mis. Kepala Instalasi Farmasi"
              autoFocus
              required
            />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Level</label>
              <select value={form.level} onChange={(e) => set("level", e.target.value)}>
                {POSITION_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {POSITION_LEVEL_LABELS[l]}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Atasan langsung</label>
              <select value={form.parentId} onChange={(e) => set("parentId", e.target.value)}>
                <option value="">— Tidak ada (puncak) —</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {"   ".repeat(p.depth)}
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Bidang</label>
            <input
              value={form.bidang}
              onChange={(e) => set("bidang", e.target.value)}
              placeholder="Kosongkan untuk mengikuti bidang atasan"
            />
          </div>
          <label className="check-line">
            <input
              type="checkbox"
              checked={form.single}
              onChange={(e) => set("single", e.target.checked)}
            />
            Hanya boleh diisi <b>1 orang</b> (jabatan struktural)
          </label>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
