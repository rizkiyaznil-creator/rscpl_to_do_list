"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { PRIORITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { formatDayKey, formatMinutes, formatWeekRange, DAY_NAMES, dayIndex } from "@/lib/logdate";

function greeting() {
  const h = new Date(Date.now() + 7 * 3600e3).getUTCHours(); // jam WIB
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function Tile({ value, label, color, href }) {
  const inner = (
    <>
      <div className="num" style={color ? { color } : undefined}>
        {value}
      </div>
      <div className="lbl">{label}</div>
    </>
  );
  return href ? (
    <Link href={href} className="stat stat-link">
      {inner}
    </Link>
  ) : (
    <div className="stat">{inner}</div>
  );
}

// Halaman ringkasan setelah login; isinya menyesuaikan peran & jabatan.
export default function Dashboard({ currentUser }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => (ok ? setData(d) : setError(d.error || "Gagal memuat dashboard.")))
      .catch(() => setError("Tidak dapat terhubung ke server."));
  }, []);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="dash-hello">
          <h2>
            {greeting()}, {currentUser.name}
          </h2>
          <p className="muted-sm">
            {data ? formatDayKey(data.today) : ""}
            {data?.me?.position && ` · ${data.me.position.name}`}
          </p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!data && !error && <div className="empty">Memuat dashboard...</div>}

        {data && (
          <>
            {data.pendingRegistrations > 0 && (
              <Link href="/admin" className="dash-banner">
                🆕 <b>{data.pendingRegistrations} pendaftar</b> menunggu verifikasi →
                Kelola Personel
              </Link>
            )}

            <div className="dash-grid">
              {/* ---------- Tugas saya ---------- */}
              <section className="dash-card">
                <div className="dash-card-head">
                  <h3>✅ Tugas Saya</h3>
                  <Link href="/tugas" className="btn btn-sm btn-ghost">
                    Lihat semua →
                  </Link>
                </div>
                <div className="dash-tiles">
                  <Tile value={data.tasks.todo} label="Belum" color="var(--todo)" />
                  <Tile value={data.tasks.inProgress} label="Sedang" color="var(--progress)" />
                  <Tile value={data.tasks.done} label="Selesai" color="var(--done)" />
                  <Tile value={data.tasks.overdue} label="Lewat tenggat" color="var(--danger)" />
                </div>
                <div className="dash-sub">Tenggat terdekat</div>
                {data.tasks.upcoming.length === 0 ? (
                  <p className="muted-sm">Tidak ada tugas aktif dengan tenggat. 🎉</p>
                ) : (
                  <ul className="dash-list">
                    {data.tasks.upcoming.map((t) => (
                      <li key={t.id}>
                        <Link href={`/tugas?task=${t.id}`}>
                          <span className="dash-list-title">{t.title}</span>
                          <span className={`dash-due ${t.overdue ? "late" : ""}`}>
                            {t.overdue ? "⚠️ " : "🗓 "}
                            {formatDate(t.dueDate)} · {PRIORITY_LABELS[t.priority]} · {t.progress}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {/* ---------- Logbook saya ---------- */}
              <section className="dash-card">
                <div className="dash-card-head">
                  <h3>📝 Logbook Saya</h3>
                  <span className="muted-sm">{formatWeekRange(data.logbook.weekStart)}</span>
                </div>
                <div className="dash-tiles three">
                  <Tile value={data.logbook.entries} label="Kegiatan" />
                  <Tile
                    value={formatMinutes(data.logbook.minutes)}
                    label="Total waktu"
                    color="var(--primary)"
                  />
                  <Tile
                    value={data.logbook.approval ? "✓" : "—"}
                    label={data.logbook.approval ? "Disetujui" : "Belum disetujui"}
                    color={data.logbook.approval ? "var(--done)" : "var(--text-muted)"}
                  />
                </div>
                {data.logbook.hasPosition && data.logbook.missingDays.length > 0 ? (
                  <>
                    <div className="dash-sub">Hari kerja yang belum diisi</div>
                    <div className="log-cats plain">
                      {data.logbook.missingDays.map((d) => (
                        <span key={d} className={`chip ${d === data.today ? "chip-warn" : ""}`}>
                          {DAY_NAMES[dayIndex(d)]}, {formatDayKey(d, false).replace(/ \d{4}$/, "")}
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  data.logbook.hasPosition && (
                    <p className="muted-sm">Semua hari kerja minggu ini sudah terisi. 👍</p>
                  )
                )}
                <p className="muted-sm">
                  {data.logbook.approval
                    ? `Disetujui oleh ${data.logbook.approval.approvedBy || "-"}.`
                    : data.logbook.approverNames.length
                      ? `Atasan langsung: ${data.logbook.approverNames.join(", ")}.`
                      : ""}
                </p>
                <Link href="/logbook" className="btn btn-primary">
                  {data.logbook.filledToday ? "Buka logbook" : "+ Isi logbook hari ini"}
                </Link>
              </section>

              {/* ---------- Bawahan ---------- */}
              {data.team && (
                <section className="dash-card wide">
                  <div className="dash-card-head">
                    <h3>👥 Bawahan</h3>
                    <span className="muted-sm">{data.team.size} personel</span>
                  </div>
                  <div className="dash-tiles three">
                    <Tile
                      value={data.team.pendingApproval}
                      label="Menunggu persetujuan Anda"
                      color={data.team.pendingApproval ? "var(--progress)" : undefined}
                      href="/logbook?tab=team"
                    />
                    <Tile
                      value={data.team.notFilledCount}
                      label="Belum mengisi logbook minggu ini"
                      color={data.team.notFilledCount ? "var(--todo)" : undefined}
                      href="/logbook?tab=team"
                    />
                    <Tile
                      value={data.team.overdueCount}
                      label="Tugas lewat tenggat"
                      color={data.team.overdueCount ? "var(--danger)" : undefined}
                      href="/tugas"
                    />
                  </div>
                  <div className="dash-cols">
                    <div>
                      <div className="dash-sub">Logbook menunggu persetujuan Anda</div>
                      {data.team.pending.length === 0 ? (
                        <p className="muted-sm">Tidak ada. 👍</p>
                      ) : (
                        <ul className="dash-list">
                          {data.team.pending.map((p) => (
                            <li key={`${p.userId}-${p.week}`}>
                              <Link href={`/logbook?tab=team&user=${p.userId}&week=${p.week}`}>
                                <span className="dash-list-title">{p.name}</span>
                                <span className="dash-due">
                                  {formatWeekRange(p.week)} · {p.entries} kegiatan
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div>
                      <div className="dash-sub">Tugas bawahan lewat tenggat</div>
                      {data.team.overdue.length === 0 ? (
                        <p className="muted-sm">Tidak ada. 👍</p>
                      ) : (
                        <ul className="dash-list">
                          {data.team.overdue.map((t) => (
                            <li key={t.id}>
                              <Link href={`/tugas?task=${t.id}`}>
                                <span className="dash-list-title">{t.title}</span>
                                <span className="dash-due late">
                                  ⚠️ {formatDate(t.dueDate)} · {t.ownerName}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  {data.team.notFilled.length > 0 && (
                    <>
                      <div className="dash-sub">Belum mengisi logbook minggu ini</div>
                      <div className="log-cats plain">
                        {data.team.notFilled.map((n) => (
                          <span key={n.userId} className="chip chip-muted">
                            {n.name}
                          </span>
                        ))}
                        {data.team.notFilledCount > data.team.notFilled.length && (
                          <span className="muted-sm">
                            +{data.team.notFilledCount - data.team.notFilled.length} lainnya
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </section>
              )}

              {/* ---------- Per bidang ---------- */}
              {data.bidang && (
                <section className="dash-card wide">
                  <div className="dash-card-head">
                    <h3>🏛 Tugas per Bidang</h3>
                    <Link href="/laporan" className="btn btn-sm btn-ghost">
                      Laporan lengkap →
                    </Link>
                  </div>
                  {data.bidang.length === 0 ? (
                    <p className="muted-sm">Belum ada tugas.</p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Bidang</th>
                            <th style={{ textAlign: "center" }}>Total</th>
                            <th style={{ textAlign: "center" }}>Selesai</th>
                            <th style={{ minWidth: 140 }}>Penyelesaian</th>
                            <th style={{ textAlign: "center" }}>Lewat tenggat</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.bidang.map((b) => (
                            <tr key={b.bidang}>
                              <td>
                                <b>{b.bidang}</b>
                              </td>
                              <td style={{ textAlign: "center" }}>{b.total}</td>
                              <td style={{ textAlign: "center" }}>{b.done}</td>
                              <td>
                                <div className="row-progress">
                                  <div className="bar done">
                                    <span style={{ width: `${b.pct}%` }} />
                                  </div>
                                  <span className="pct">{b.pct}%</span>
                                </div>
                              </td>
                              <td
                                style={{
                                  textAlign: "center",
                                  color: b.overdue ? "var(--danger)" : undefined,
                                  fontWeight: b.overdue ? 700 : undefined,
                                }}
                              >
                                {b.overdue}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </main>
    </>
  );
}
