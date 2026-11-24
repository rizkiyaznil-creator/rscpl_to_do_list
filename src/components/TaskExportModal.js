"use client";

import { useState } from "react";
import { hospital } from "@/lib/hospitalProfile";
import {
  PERIODS,
  periodRange,
  periodLabel,
  inPeriod,
  summarize,
  generateTasksPdf,
  downloadTasksXlsx,
} from "@/lib/taskExport";

// Ekspor laporan tugas: daftar yang sedang tampil di Papan Tugas (mengikuti
// filter), dapat dibatasi periode tenggat, ke PDF atau Excel.
export default function TaskExportModal({ tasks, filterLabel, currentUser, onClose }) {
  const [kind, setKind] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState("");

  const range = periodRange(kind, from, to);
  const list = tasks.filter((t) => inPeriod(t, range));
  const s = summarize(list);
  const customIncomplete = kind === "custom" && !range;

  async function run(format) {
    setBusy(format);
    const data = {
      tasks: list,
      range,
      filterLabel,
      periodText: periodLabel(kind, range),
      printedBy: currentUser.name,
      hospital,
    };
    try {
      if (format === "pdf") await generateTasksPdf(data);
      else await downloadTasksXlsx(data);
    } catch (e) {
      alert("Gagal membuat file: " + (e?.message || "kesalahan tak terduga"));
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>⬇ Ekspor laporan tugas</h3>
        <p className="muted-sm" style={{ marginTop: 0 }}>
          Berisi tugas yang sedang tampil di Papan Tugas — <b>{filterLabel}</b>. Tugas belum selesai
          di bagian atas, tugas selesai di bawah.
        </p>

        <div className="field">
          <label htmlFor="exp-period">Periode (berdasarkan tenggat)</label>
          <select id="exp-period" value={kind} onChange={(e) => setKind(e.target.value)}>
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        {kind === "custom" && (
          <div className="field-row">
            <div className="field">
              <label htmlFor="exp-from">Dari</label>
              <input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="exp-to">Sampai</label>
              <input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        )}

        <div className="export-summary">
          <span><b>{s.total}</b> tugas</span>
          <span><b>{s.todo + s.inProgress}</b> belum selesai</span>
          <span><b>{s.done}</b> selesai</span>
          {s.overdue > 0 && <span className="late"><b>{s.overdue}</b> lewat tenggat</span>}
        </div>
        {kind !== "all" && (
          <p className="muted-sm" style={{ margin: "6px 0 0" }}>
            Tugas tanpa tenggat hanya ikut pada periode “Semua tenggat”.
          </p>
        )}

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn"
            onClick={() => run("xlsx")}
            disabled={Boolean(busy) || customIncomplete || s.total === 0}
          >
            {busy === "xlsx" ? "Membuat..." : "⬇ Excel"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => run("pdf")}
            disabled={Boolean(busy) || customIncomplete || s.total === 0}
          >
            {busy === "pdf" ? "Membuat..." : "🖨 PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
