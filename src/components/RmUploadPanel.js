"use client";

import { useState } from "react";
import { parseRmFiles, rmChecks } from "@/lib/rmParse";
import { fmt, MONTHS } from "@/lib/perfcalc";

const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

// Unggah Laporan Rekam Medis bulanan (.xlsx, boleh banyak, atau .zip).
// File dibaca di browser; yang dikirim ke server hanya ringkasan per bulan.
export default function RmUploadPanel({ onSaved }) {
  const [files, setFiles] = useState([]);
  const [parsed, setParsed] = useState(null);
  const [progress, setProgress] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [open, setOpen] = useState(false);

  async function read() {
    setBusy(true);
    setMsg(null);
    setParsed(null);
    try {
      const list = await Promise.all([...files].map(async (f) => ({ name: f.name, buffer: await f.arrayBuffer() })));
      const res = await parseRmFiles(list, (i, n, name) => setProgress(`Membaca ${i}/${n}: ${name}`));
      setParsed(res);
    } catch (e) {
      setMsg({ type: "error", text: `Gagal membaca file: ${e?.message || e}` });
    } finally {
      setProgress("");
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/performa/rekam-medis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reports: parsed.reports }),
      });
      const d = await res.json();
      if (!res.ok) setMsg({ type: "error", text: d.error || "Gagal menyimpan." });
      else {
        const saved = d.result.filter((r) => r.status !== "lewati");
        const skipped = d.result.filter((r) => r.status === "lewati");
        setMsg({
          type: "success",
          text: `Tersimpan ${saved.length} bulan.${skipped.length ? ` Dilewati: ${skipped.map((s) => `${monthLabel(s.bulan)} (${s.alasan})`).join("; ")}.` : ""}`,
        });
        setParsed(null);
        setFiles([]);
        onSaved?.();
      }
    } catch {
      setMsg({ type: "error", text: "Tidak dapat terhubung ke server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="fsec import-box" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        <b>🏥 Unggah Laporan Rekam Medis</b>
        <span className="muted-sm"> — file Excel bulanan dari Unit RM (RJ, IGD, Rawat Inap)</span>
      </summary>
      <p className="muted-sm" style={{ margin: "6px 0 10px" }}>
        Pilih satu atau banyak file <b>.xlsx</b> laporan RM, atau file <b>.zip</b> berisi laporan. Bila ada beberapa revisi
        untuk bulan yang sama, yang <b>terakhir disimpan</b> otomatis dipakai. Mengisi otomatis: kunjungan rawat jalan, IGD,
        pasien dirawat inap, laboratorium, radiologi, dan indikator BOR/ALOS/TOI/BTO/NDR/GDR.
      </p>
      <div className="row-actions" style={{ flexWrap: "wrap" }}>
        <input
          type="file"
          multiple
          accept=".xlsx,.zip"
          onChange={(e) => {
            setFiles(e.target.files || []);
            setParsed(null);
            setMsg(null);
          }}
        />
        <button className="btn btn-sm" onClick={read} disabled={!files.length || busy}>
          Periksa file
        </button>
        {parsed?.reports.length > 0 && (
          <button className="btn btn-sm btn-primary" onClick={save} disabled={busy}>
            Simpan {parsed.reports.length} bulan
          </button>
        )}
      </div>
      {progress && <p className="muted-sm">{progress}</p>}
      {msg && <div className={`alert alert-${msg.type}`} style={{ marginTop: 10 }}>{msg.text}</div>}

      {parsed && (
        <div style={{ marginTop: 10 }}>
          <p className="muted-sm">
            {parsed.files} file dibaca → <b>{parsed.reports.length} bulan</b>.
            {parsed.errors.length > 0 && <span className="rm-warn"> {parsed.errors.join("; ")}</span>}
          </p>
          <div className="table-wrap">
            <table className="t2">
              <thead>
                <tr>
                  <th>Bulan</th><th className="n">Rawat jalan</th><th className="n">IGD</th><th className="n">Rawat inap</th>
                  <th className="n">BOR</th><th className="n">ALOS</th><th className="n">Lab</th><th className="n">Radiologi</th>
                  <th>File dipakai</th><th>Catatan</th>
                </tr>
              </thead>
              <tbody>
                {parsed.reports.map((r) => {
                  const pen = (re) => r.rj?.penunjang?.find((p) => re.test(p.nama))?.jumlah;
                  const notes = rmChecks(r);
                  return (
                    <tr key={r.bulan}>
                      <td>{monthLabel(r.bulan)}</td>
                      <td className="n">{fmt(r.rj?.total, 0)}</td>
                      <td className="n">{fmt(r.igd?.total, 0)}</td>
                      <td className="n">{fmt(r.ri?.total, 0)}</td>
                      <td className="n">{r.ri?.bor == null ? "—" : `${fmt(r.ri.bor, 1)}%`}</td>
                      <td className="n">{fmt(r.ri?.los, 1)}</td>
                      <td className="n">{fmt(pen(/^lab/i), 0)}</td>
                      <td className="n">{fmt(pen(/radiolog/i), 0)}</td>
                      <td className="muted-sm">
                        {r.file}
                        {r.versi > 1 ? ` (terbaru dari ${r.versi} versi)` : ""}
                      </td>
                      <td className={notes.length ? "rm-warn" : "muted-sm"}>{notes.length ? notes.join("; ") : "✓"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </details>
  );
}
