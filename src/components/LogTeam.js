"use client";

import { useState, useEffect, useCallback } from "react";
import LogWeekNav from "@/components/LogWeekNav";
import { hospital } from "@/lib/hospitalProfile";
import { formatMinutes } from "@/lib/logdate";
import { initials } from "@/lib/format";
import { generateTeamPdf, downloadTeamCsv } from "@/lib/logbookExport";

// Rekap logbook bawahan per minggu (untuk atasan, Admin, Direktur, Kepala SPI).
export default function LogTeam({ week, setWeek, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [bidang, setBidang] = useState("all");
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/logbook/team?week=${week}`);
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d.error || "Gagal memuat rekap.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    }
  }, [week]);

  useEffect(() => {
    load();
  }, [load]);

  async function approve(m) {
    if (!confirm(`Setujui logbook ${m.name} minggu ini? Logbook akan terkunci.`)) return;
    setBusyId(m.id);
    try {
      const res = await fetch("/api/logbook/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: m.id, week }),
      });
      const d = await res.json();
      if (res.ok) load();
      else alert(d.error || "Gagal menyetujui.");
    } catch {
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setBusyId(null);
    }
  }

  const members = data?.members || [];
  const bidangList = [...new Set(members.map((m) => m.position?.bidang || "Belum ada jabatan"))];
  const term = q.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      (bidang === "all" || (m.position?.bidang || "Belum ada jabatan") === bidang) &&
      (!term || m.name.toLowerCase().includes(term)),
  );
  const filled = shown.filter((m) => m.entries > 0).length;
  const approved = shown.filter((m) => m.approval).length;
  const minutes = shown.reduce((s, m) => s + m.minutes, 0);

  async function exportAs(kind) {
    if (!data) return;
    const payload = { weekStart: data.weekStart, weekEnd: data.weekEnd, members: shown, byCategory: data.byCategory };
    try {
      if (kind === "pdf") await generateTeamPdf({ ...payload, hospital });
      else downloadTeamCsv(payload);
    } catch (e) {
      alert("Gagal membuat file: " + (e?.message || "kesalahan tak terduga"));
    }
  }

  return (
    <section>
      <LogWeekNav week={week} setWeek={setWeek} />
      {error && <div className="alert alert-error">{error}</div>}
      {!data ? (
        <div className="empty">Memuat rekap...</div>
      ) : (
        <>
          <div className="stats">
            <div className="stat">
              <div className="num">{shown.length}</div>
              <div className="lbl">Personel</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--progress)" }}>{filled}</div>
              <div className="lbl">Sudah mengisi</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--done)" }}>{approved}</div>
              <div className="lbl">Disetujui</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--primary)" }}>{formatMinutes(minutes)}</div>
              <div className="lbl">Total waktu</div>
            </div>
          </div>

          {data.byCategory.length > 0 && (
            <div className="log-cats" style={{ marginBottom: 12 }}>
              {data.byCategory.map((c) => (
                <span key={c.category} className="chip">
                  {c.category} · <b>{formatMinutes(c.minutes)}</b>
                </span>
              ))}
            </div>
          )}

          <div className="toolbar">
            <input
              className="grow"
              type="search"
              placeholder="Cari nama personel..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={bidang} onChange={(e) => setBidang(e.target.value)}>
              <option value="all">Semua bidang</option>
              {bidangList.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" onClick={() => exportAs("csv")}>
              ⬇ CSV
            </button>
            <button className="btn btn-sm" onClick={() => exportAs("pdf")}>
              🖨 PDF
            </button>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Personel</th>
                  <th>Jabatan</th>
                  <th style={{ textAlign: "center" }}>Kegiatan</th>
                  <th style={{ textAlign: "right" }}>Total waktu</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="muted-sm">
                      Tidak ada personel yang cocok.
                    </td>
                  </tr>
                )}
                {shown.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="owner-line">
                        <span className="avatar">{initials(m.name)}</span>
                        <b>{m.name}</b>
                      </div>
                    </td>
                    <td>
                      {m.position?.name || <span className="muted-sm">Belum ditetapkan</span>}
                      {m.position && <div className="muted-sm">{m.position.bidang}</div>}
                    </td>
                    <td style={{ textAlign: "center" }}>{m.entries}</td>
                    <td style={{ textAlign: "right" }}>{formatMinutes(m.minutes)}</td>
                    <td>
                      {m.approval ? (
                        <span className="badge status-DONE" title={`oleh ${m.approval.approvedBy || "-"}`}>
                          Disetujui
                        </span>
                      ) : m.revision === "OPEN" ? (
                        <span className="badge status-revise" title="Menunggu perbaikan oleh personel">
                          ↩️ Dikembalikan
                        </span>
                      ) : m.revision === "FIXED" ? (
                        <span className="badge status-IN_PROGRESS">🛠 Sudah diperbaiki</span>
                      ) : m.entries > 0 ? (
                        <span className="badge status-IN_PROGRESS">Belum disetujui</span>
                      ) : (
                        <span className="badge status-TODO">Belum mengisi</span>
                      )}
                      {m.comments > 0 && (
                        <span className="muted-sm" title="Jumlah komentar minggu ini" style={{ marginLeft: 6 }}>
                          💬 {m.comments}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => onOpen({ id: m.id, name: m.name })}>
                          Lihat
                        </button>
                        {m.canApprove && !m.approval && m.entries > 0 && (
                          <button
                            className="btn btn-sm btn-primary"
                            onClick={() => approve(m)}
                            disabled={busyId === m.id}
                          >
                            ✓ Setujui
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
