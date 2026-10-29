"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { PERF_GROUPS, PERF_FREQ_LABELS, PERF_KIND_LABELS } from "@/lib/constants";
import { PERF_GROUP_ORDER, targetLabel } from "@/lib/perfcalc";

// Kelola parameter Performa RS (khusus admin).
export default function PerformaParams({ currentUser }) {
  const [params, setParams] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // {} = baru

  async function load() {
    try {
      const res = await fetch("/api/performa/params");
      const d = await res.json();
      if (res.ok) setParams(d.params || []);
      else setError(d.error || "Gagal memuat parameter.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function patch(p, body) {
    const res = await fetch(`/api/performa/params/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const d = await res.json();
    if (!res.ok) alert(d.error || "Gagal menyimpan.");
    load();
  }

  async function remove(p) {
    if (!confirm(`Hapus parameter "${p.name}"?`)) return;
    const res = await fetch(`/api/performa/params/${p.id}`, { method: "DELETE" });
    const d = await res.json();
    if (!res.ok) alert(d.error || "Gagal menghapus.");
    load();
  }

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="pf-head">
          <Link href="/performa" className="btn btn-sm btn-ghost">← Performa RS</Link>
          <h2>⚙ Parameter Performa RS</h2>
          <div className="spacer" />
          <button className="btn btn-primary" onClick={() => setEditing({})}>+ Tambah parameter</button>
        </div>
        <p className="muted-sm" style={{ marginTop: -4 }}>
          Parameter bertanda <b>inti</b> dipakai rumus BOR/ALOS/TOI/BTO/GDR/NDR. Parameter yang sudah berisi data
          tidak bisa dihapus — nonaktifkan saja agar riwayatnya tetap tersimpan.
        </p>
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="empty">Memuat...</div>
        ) : (
          PERF_GROUP_ORDER.filter((g) => params.some((p) => p.group === g)).map((g) => (
            <section key={g} className="fsec">
              <h3>{g}. {PERF_GROUPS[g]}</h3>
              <div className="table-wrap">
                <table className="t2">
                  <thead>
                    <tr><th>Parameter</th><th>Kode</th><th>Frekuensi</th><th>Jenis</th><th>Sumber</th><th>Target</th><th className="n">Data</th><th></th></tr>
                  </thead>
                  <tbody>
                    {params.filter((p) => p.group === g).map((p) => (
                      <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                        <td>
                          <b>{p.name}</b>
                          {p.builtin && <span className="badge badge-staff" style={{ marginLeft: 6 }}>inti</span>}
                          {!p.active && <span className="badge status-TODO" style={{ marginLeft: 6 }}>nonaktif</span>}
                        </td>
                        <td className="muted-sm">{p.code}</td>
                        <td>{PERF_FREQ_LABELS[p.freq]}</td>
                        <td className="muted-sm">{PERF_KIND_LABELS[p.kind]?.split(" (")[0]}</td>
                        <td className="muted-sm">{p.source || "—"}</td>
                        <td>{targetLabel(p)}</td>
                        <td className="n">{p._count?.values ?? 0}</td>
                        <td style={{ textAlign: "right" }}>
                          <div className="row-actions">
                            <button className="btn btn-sm" onClick={() => setEditing(p)}>Ubah</button>
                            {!p.builtin && (
                              <button className="btn btn-sm" onClick={() => patch(p, { active: !p.active })}>
                                {p.active ? "Nonaktifkan" : "Aktifkan"}
                              </button>
                            )}
                            {!p.builtin && !(p._count?.values > 0) && (
                              <button className="btn btn-sm btn-danger" onClick={() => remove(p)}>Hapus</button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </main>
      {editing && (
        <ParamModal
          param={editing.id ? editing : null}
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

function ParamModal({ param, onClose, onSaved }) {
  const isNew = !param;
  const locked = param && (param.builtin || param._count?.values > 0);
  const [form, setForm] = useState({
    name: param?.name || "",
    group: param?.group || "A",
    freq: param?.freq || "WEEK",
    kind: param?.kind || "COUNT",
    unit: param?.unit || "",
    source: param?.source || "",
    targetOp: param?.targetOp || "GTE",
    target: param?.target ?? "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const hasTarget = form.kind === "RATIO" || form.kind === "SCORE";

  async function submit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const body = { ...form, target: hasTarget ? form.target : "" };
    if (locked) {
      delete body.kind;
      delete body.freq;
    }
    try {
      const res = await fetch(isNew ? "/api/performa/params" : `/api/performa/params/${param.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error || "Gagal menyimpan.");
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
        <h3>{isNew ? "Tambah Parameter" : "Ubah Parameter"}</h3>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field">
            <label>Nama parameter *</label>
            <input value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Kelompok</label>
              <select value={form.group} onChange={(e) => set("group", e.target.value)}>
                {PERF_GROUP_ORDER.map((g) => <option key={g} value={g}>{g}. {PERF_GROUPS[g]}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Frekuensi input</label>
              <select value={form.freq} onChange={(e) => set("freq", e.target.value)} disabled={locked}>
                {Object.entries(PERF_FREQ_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Jenis</label>
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)} disabled={locked}>
              {Object.entries(PERF_KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            {locked && <small className="muted-sm">Jenis & frekuensi terkunci (parameter inti / sudah berisi data).</small>}
          </div>
          <div className="field-row">
            <div className="field">
              <label>Satuan</label>
              <input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="mis. pasien" />
            </div>
            <div className="field">
              <label>Sumber data / unit PIC</label>
              <input value={form.source} onChange={(e) => set("source", e.target.value)} placeholder="mis. Rekam Medis" />
            </div>
          </div>
          {hasTarget && (
            <div className="field-row">
              <div className="field">
                <label>Arah target</label>
                <select value={form.targetOp} onChange={(e) => set("targetOp", e.target.value)}>
                  <option value="GTE">≥ (makin tinggi makin baik)</option>
                  <option value="LTE">≤ (makin rendah makin baik)</option>
                </select>
              </div>
              <div className="field">
                <label>Target {form.kind === "RATIO" ? "(%)" : "(nilai)"}</label>
                <input inputMode="decimal" value={form.target} onChange={(e) => set("target", e.target.value)} placeholder="kosongkan bila tanpa target" />
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Menyimpan..." : "Simpan"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
