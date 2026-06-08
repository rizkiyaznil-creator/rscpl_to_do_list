"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { initials, timeAgo, formatDate } from "@/lib/format";
import { hospital } from "@/lib/hospitalProfile";
import { generateReportPdf } from "@/lib/reportPdf";

// Bungkus nilai agar aman sebagai field CSV.
function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function csvRow(cells) {
  return cells.map(csvCell).join(",");
}

// Bar mini untuk visualisasi komposisi status (todo/progress/done).
function MiniBar({ todo, inProgress, done, total }) {
  if (!total) return <div className="minibar empty-bar" />;
  const pct = (n) => `${(n / total) * 100}%`;
  return (
    <div className="minibar" title={`Selesai ${done}, berjalan ${inProgress}, belum ${todo}`}>
      <span className="seg done" style={{ width: pct(done) }} />
      <span className="seg prog" style={{ width: pct(inProgress) }} />
      <span className="seg todo" style={{ width: pct(todo) }} />
    </div>
  );
}

export default function Reports({ currentUser }) {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/stats").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/activity?limit=40").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ])
      .then(([s, a, t]) => {
        if (!active) return;
        if (s.ok) setStats(s.d);
        else setError(s.d.error || "Gagal memuat statistik.");
        setActivities(a.activities || []);
        setTasks(t.tasks || []);
      })
      .catch(() => active && setError("Tidak dapat terhubung ke server."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  // ---- Ekspor CSV (unduhan file .csv) ----
  function exportCSV() {
    if (!stats) return;
    const tgl = formatDate(new Date());
    const lines = [];
    lines.push(csvRow([`Laporan & Statistik - ${hospital.fullName}`]));
    lines.push(csvRow([`Tanggal cetak: ${tgl}`]));
    lines.push("");

    lines.push(csvRow(["Ringkasan"]));
    lines.push(csvRow(["Metrik", "Nilai"]));
    lines.push(csvRow(["Total tugas", stats.totals.total]));
    lines.push(csvRow(["Belum dikerjakan", stats.totals.todo]));
    lines.push(csvRow(["Sedang dikerjakan", stats.totals.inProgress]));
    lines.push(csvRow(["Selesai", stats.totals.done]));
    lines.push(csvRow(["Lewat tenggat", stats.totals.overdue]));
    lines.push(csvRow(["Tingkat penyelesaian (%)", stats.totals.completionRate]));
    lines.push("");

    lines.push(csvRow(["Per Departemen"]));
    lines.push(csvRow(["Departemen", "Total", "Belum", "Sedang", "Selesai", "Lewat tenggat"]));
    for (const d of stats.byDepartment) {
      lines.push(csvRow([d.department, d.total, d.todo, d.inProgress, d.done, d.overdue]));
    }
    lines.push("");

    lines.push(csvRow(["Beban Kerja Personel"]));
    lines.push(csvRow(["Personel", "Departemen", "Peran", "Total", "Belum", "Sedang", "Selesai", "Lewat tenggat"]));
    for (const p of stats.byPerson) {
      lines.push(csvRow([p.name, p.department, p.role, p.total, p.todo, p.inProgress, p.done, p.overdue]));
    }

    // BOM agar Excel membaca karakter Indonesia dengan benar.
    const blob = new Blob(["﻿" + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laporan-${hospital.name.toLowerCase()}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Ekspor PDF (file PDF profesional via jsPDF) ----
  async function exportPDF() {
    if (!stats) return;
    setPdfBusy(true);
    try {
      await generateReportPdf({ stats, tasks, hospital });
    } catch (e) {
      alert("Gagal membuat PDF: " + (e?.message || "kesalahan tak terduga"));
    } finally {
      setPdfBusy(false);
    }
  }

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        {/* Header cetak (hanya tampil saat dicetak/PDF) */}
        <div className="print-only print-header">
          <h1>{hospital.fullName}</h1>
          <p>Laporan &amp; Statistik Tugas — dicetak {formatDate(new Date())}</p>
        </div>

        <div className="section-head no-print" style={{ marginTop: 0 }}>
          <Link href="/dashboard" className="btn btn-sm btn-ghost">
            ← Kembali
          </Link>
          <h2 style={{ fontSize: 20 }}>Laporan &amp; Statistik</h2>
          <div className="spacer" />
          <button className="btn btn-sm" onClick={exportCSV} disabled={!stats}>
            ⬇ Ekspor CSV
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={exportPDF}
            disabled={!stats || pdfBusy}
          >
            {pdfBusy ? "Membuat PDF..." : "🖨 Unduh PDF"}
          </button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="empty">Memuat laporan...</div>
        ) : !stats ? null : (
          <>
            {/* Ringkasan */}
            <div className="stats" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
              <div className="stat">
                <div className="num">{stats.totals.total}</div>
                <div className="lbl">Total tugas</div>
              </div>
              <div className="stat">
                <div className="num" style={{ color: "var(--progress)" }}>
                  {stats.totals.inProgress}
                </div>
                <div className="lbl">Sedang dikerjakan</div>
              </div>
              <div className="stat">
                <div className="num" style={{ color: "var(--done)" }}>
                  {stats.totals.done}
                </div>
                <div className="lbl">Selesai</div>
              </div>
              <div className="stat">
                <div className="num" style={{ color: "var(--danger)" }}>
                  {stats.totals.overdue}
                </div>
                <div className="lbl">Lewat tenggat</div>
              </div>
              <div className="stat">
                <div className="num" style={{ color: "var(--primary)" }}>
                  {stats.totals.completionRate}%
                </div>
                <div className="lbl">Penyelesaian</div>
              </div>
            </div>

            <div className="report-grid">
              {/* Per departemen */}
              <section>
                <div className="section-head">
                  <h2>Per Departemen</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Departemen</th>
                      <th>Komposisi</th>
                      <th style={{ textAlign: "right" }}>Selesai</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byDepartment.length === 0 && (
                      <tr>
                        <td colSpan={4} className="muted-sm">
                          Belum ada data.
                        </td>
                      </tr>
                    )}
                    {stats.byDepartment.map((d) => (
                      <tr key={d.department}>
                        <td>
                          <b>{d.department}</b>
                          {d.overdue > 0 && (
                            <span className="badge status-TODO" style={{ marginLeft: 6 }}>
                              {d.overdue} lewat
                            </span>
                          )}
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <MiniBar {...d} />
                        </td>
                        <td style={{ textAlign: "right" }}>{d.done}</td>
                        <td style={{ textAlign: "right" }}>{d.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Per personel */}
              <section>
                <div className="section-head">
                  <h2>Beban Kerja Personel</h2>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Personel</th>
                      <th>Komposisi</th>
                      <th style={{ textAlign: "right" }}>Aktif</th>
                      <th style={{ textAlign: "right" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byPerson.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="owner-line">
                            <span className="avatar">{initials(p.name)}</span>
                            <span>
                              <b>{p.name}</b>
                              <br />
                              <small style={{ color: "var(--text-muted)" }}>
                                {p.department}
                              </small>
                            </span>
                          </div>
                        </td>
                        <td style={{ minWidth: 140 }}>
                          <MiniBar {...p} />
                        </td>
                        <td style={{ textAlign: "right" }}>{p.todo + p.inProgress}</td>
                        <td style={{ textAlign: "right" }}>{p.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            {/* Riwayat aktivitas global */}
            <div className="section-head">
              <h2>Riwayat Aktivitas Terbaru</h2>
              <span className="count">audit log</span>
            </div>
            <div className="card">
              <ul className="activity">
                {activities.length === 0 && (
                  <li className="muted-sm">Belum ada aktivitas.</li>
                )}
                {activities.map((a) => (
                  <li key={a.id}>
                    <span className="dot" />
                    <span>
                      <b>{a.actor?.name || "Sistem"}</b> — {a.detail || a.action}
                      {a.task && (
                        <span className="muted-sm"> ({a.task.title})</span>
                      )}
                      <small> · {timeAgo(a.createdAt)}</small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="legend">
              <span className="dot-legend done" /> Selesai
              <span className="dot-legend prog" /> Sedang dikerjakan
              <span className="dot-legend todo" /> Belum dikerjakan
            </p>
          </>
        )}
      </main>
    </>
  );
}
