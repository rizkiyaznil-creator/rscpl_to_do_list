"use client";

import { useState } from "react";
import { KS_TIPE, fmtTgl } from "@/lib/kerjasama";

// Impor tabulasi kerjasama dari Excel: dibaca di browser (lib/ksImport.js),
// pratinjau + koreksi tipe per baris, lalu dikirim bertahap ke /api/kerjasama/impor.
export default function KsImport({ today, onClose, onDone }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [onlyActive, setOnlyActive] = useState(false);

  async function read() {
    setBusy("Membaca file...");
    setError("");
    try {
      const { parseKsWorkbook } = await import("@/lib/ksImport");
      const r = await parseKsWorkbook(await file.arrayBuffer(), today);
      setRows(r.rows.map((x) => ({ ...x, include: !x.error })));
      setSheets(r.sheets);
    } catch (e) {
      setError(`Gagal membaca file: ${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  const upd = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = (rows || []).filter((r) => r.include && !r.error && (!onlyActive || r.aktif));

  async function save() {
    const { toPayload } = await import("@/lib/ksImport");
    setError("");
    let created = 0;
    const skipped = [];
    const list = chosen.map(toPayload);
    try {
      for (let i = 0; i < list.length; i += 50) {
        setBusy(`Menyimpan ${Math.min(i + 50, list.length)}/${list.length}...`);
        const res = await fetch("/api/kerjasama/impor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: list.slice(i, i + 50) }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Gagal menyimpan.");
        created += d.created;
        skipped.push(...d.skipped.map((s) => ({ ...s, row: chosen[i + s.i] })));
      }
      setResult({ created, skipped });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="modal-overlay" onClick={busy ? undefined : onClose}>
      <div className="modal modal-wide ks-import" onClick={(e) => e.stopPropagation()}>
        <h3>⬆ Impor Excel Tabulasi Kerjasama</h3>
        <p className="muted-sm">
          Semua sheet yang memiliki kolom <b>Nama Mitra/Instansi</b> dan <b>No KS</b> dibaca (mis. BANK PKS, KS 2024–2026). Baris yang
          sama di beberapa sheet digabung otomatis. Data impor langsung final dan ditandai <b>perlu dilengkapi</b> (nama pimpinan,
          link dokumen, periode evaluasi) sampai diisi. Kerjasama yang nomor dokumen + mitranya sudah ada di aplikasi dilewati.
        </p>

        {!result && (
          <div className="row-actions" style={{ flexWrap: "wrap" }}>
            <input type="file" accept=".xlsx" onChange={(e) => { setFile(e.target.files?.[0] || null); setRows(null); }} />
            <button className="btn btn-sm" disabled={!file || Boolean(busy)} onClick={read}>Periksa file</button>
          </div>
        )}
        {busy && <p className="muted-sm">{busy}</p>}
        {error && <div className="alert alert-error">{error}</div>}

        {result && (
          <div className="alert alert-success">
            Tersimpan {result.created} kerjasama.
            {result.skipped.length > 0 && (
              <div className="muted-sm" style={{ marginTop: 6 }}>
                Dilewati {result.skipped.length}:{" "}
                {result.skipped.slice(0, 10).map((s) => `${s.row?.mitra[0]?.nama || "?"} (${s.alasan})`).join("; ")}
                {result.skipped.length > 10 ? "; ..." : ""}
              </div>
            )}
          </div>
        )}

        {rows && !result && (
          <>
            <p className="muted-sm">
              {sheets.map((s) => `${s.name}: ${s.count} baris`).join(" · ")} → <b>{rows.length} kerjasama unik</b>,{" "}
              {rows.filter((r) => r.aktif && !r.error).length} masih berlaku, {rows.filter((r) => r.error).length} bermasalah.
            </p>
            <div className="row-actions" style={{ flexWrap: "wrap" }}>
              <label className="ks-check">
                <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} /> hanya yang masih berlaku
              </label>
              <span className="spacer" />
              <button className="btn btn-sm btn-primary" disabled={!chosen.length || Boolean(busy)} onClick={save}>
                Simpan {chosen.length} kerjasama
              </button>
            </div>
            <div className="table-wrap ks-import-table">
              <table className="t2">
                <thead>
                  <tr><th /><th>Mitra</th><th>Tipe (jenis di Excel)</th><th>Masa</th><th>Nomor dokumen</th><th>Catatan</th></tr>
                </thead>
                <tbody>
                  {rows.map((r, i) =>
                    onlyActive && !r.aktif ? null : (
                      <tr key={`${r.sheet}-${r.rowNo}`} className={r.error ? "late" : r.aktif ? "" : "ks-dim"}>
                        <td><input type="checkbox" checked={r.include} disabled={Boolean(r.error)} onChange={(e) => upd(i, { include: e.target.checked })} /></td>
                        <td>
                          {r.mitra.map((m) => <div key={m.nama}><b>{m.nama}</b></div>)}
                          <div className="muted-sm">{r.data.isi}</div>
                        </td>
                        <td>
                          <select value={r.tipe} onChange={(e) => upd(i, { tipe: e.target.value })}>
                            {KS_TIPE.map(([v, l]) => <option key={v} value={v}>{l.replace("Kerjasama ", "")}</option>)}
                          </select>
                          <div className="muted-sm">{r.jenisAsal || "—"}</div>
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {fmtTgl(r.data.mulai)} – {r.data.berakhir ? fmtTgl(r.data.berakhir) : "tanpa batas"}
                          <div className="muted-sm">{r.aktif ? "masih berlaku" : "sudah berakhir"}</div>
                        </td>
                        <td className="muted-sm ks-nomor">{r.data.nomorDokumen || "—"}</td>
                        <td className="muted-sm">
                          {r.error && <div className="ks-alarm danger">{r.error}</div>}
                          {r.flags.map((f) => <div key={f}>{f}</div>)}
                          <div>{r.sheet} baris {r.rowNo}{r.alsoIn ? ` (juga di ${r.alsoIn.join(", ")})` : ""}</div>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="modal-actions">
          {result ? (
            <button className="btn btn-primary" onClick={onDone}>Selesai</button>
          ) : (
            <button className="btn" onClick={onClose} disabled={Boolean(busy)}>Tutup</button>
          )}
        </div>
      </div>
    </div>
  );
}
