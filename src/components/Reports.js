"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { initials, timeAgo } from "@/lib/format";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/stats").then((r) => r.json().then((d) => ({ ok: r.ok, d }))),
      fetch("/api/activity?limit=40").then((r) => r.json()),
    ])
      .then(([s, a]) => {
        if (!active) return;
        if (s.ok) setStats(s.d);
        else setError(s.d.error || "Gagal memuat statistik.");
        setActivities(a.activities || []);
      })
      .catch(() => active && setError("Tidak dapat terhubung ke server."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <Link href="/dashboard" className="btn btn-sm btn-ghost">
            ← Kembali
          </Link>
          <h2 style={{ fontSize: 20 }}>Laporan &amp; Statistik</h2>
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
