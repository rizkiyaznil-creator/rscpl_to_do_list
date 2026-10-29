"use client";

import { useState, useEffect, useCallback } from "react";
import LogWeekNav from "@/components/LogWeekNav";
import LogEntryModal from "@/components/LogEntryModal";
import { hospital } from "@/lib/hospitalProfile";
import {
  addDays,
  todayKey,
  formatDayKey,
  formatMinutes,
  DAY_NAMES,
} from "@/lib/logdate";
import { formatDate } from "@/lib/format";
import { generateLogbookPdf, downloadLogbookCsv } from "@/lib/logbookExport";

async function sendJson(url, method, body) {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { ok: res.ok, data: await res.json() };
  } catch {
    return { ok: false, data: { error: "Tidak dapat terhubung ke server." } };
  }
}

// Bulan penuh yang memuat tanggal `key` -> { from, to }.
function monthRange(key) {
  const [y, m] = key.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

// Logbook satu minggu milik seorang personel (milik sendiri atau bawahan).
export default function LogWeek({ userId, week, setWeek, categories, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { entry } | { date }
  const [busy, setBusy] = useState(false);
  const [exportPeriod, setExportPeriod] = useState("week");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/logbook?userId=${userId}&from=${week}&to=${addDays(week, 6)}`);
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d.error || "Gagal memuat logbook.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [userId, week]);

  useEffect(() => {
    load();
  }, [load]);

  const today = todayKey();
  const entries = data?.entries || [];
  const perms = data?.perms || {};
  const approval = (data?.approvals || []).find((a) => a.weekStart === week) || null;
  const locked = Boolean(approval);
  const canEdit = (perms.isOwner && !locked) || (locked && perms.canOverride);
  const canAdd = perms.isOwner && !locked && week <= today;
  const totalMinutes = entries.reduce((s, e) => s + e.minutes, 0);

  const byCategory = [];
  for (const e of entries) {
    const c = byCategory.find((x) => x.category === e.category);
    if (c) c.minutes += e.minutes;
    else byCategory.push({ category: e.category, minutes: e.minutes });
  }
  byCategory.sort((a, b) => b.minutes - a.minutes);

  async function approve() {
    if (!confirm("Setujui logbook minggu ini? Setelah disetujui, logbook akan terkunci.")) return;
    setBusy(true);
    const { ok, data: d } = await sendJson("/api/logbook/approve", "POST", { userId, week });
    setBusy(false);
    if (ok) load();
    else alert(d.error || "Gagal menyetujui.");
  }

  async function unapprove() {
    if (!confirm("Batalkan persetujuan? Logbook minggu ini akan terbuka kembali untuk diubah pemiliknya.")) return;
    setBusy(true);
    const { ok, data: d } = await sendJson("/api/logbook/approve", "DELETE", { userId, week });
    setBusy(false);
    if (ok) load();
    else alert(d.error || "Gagal membatalkan persetujuan.");
  }

  async function remove(entry) {
    if (!confirm(`Hapus kegiatan "${entry.description.slice(0, 60)}"?`)) return;
    const { ok, data: d } = await sendJson(`/api/logbook/${entry.id}`, "DELETE");
    if (ok) load();
    else alert(d.error || "Gagal menghapus.");
  }

  async function exportAs(kind) {
    if (!data) return;
    let payload = { owner: data.owner, from: week, to: addDays(week, 6), entries, approvals: data.approvals };
    if (exportPeriod === "month") {
      const r = monthRange(week);
      const res = await fetch(`/api/logbook?userId=${userId}&from=${r.from}&to=${r.to}`);
      const d = await res.json();
      if (!res.ok) return alert(d.error || "Gagal memuat data bulan ini.");
      payload = { owner: d.owner, from: r.from, to: r.to, entries: d.entries, approvals: d.approvals };
    }
    try {
      if (kind === "pdf") {
        await generateLogbookPdf({ ...payload, approverNames: perms.approverNames, hospital });
      } else {
        downloadLogbookCsv(payload);
      }
    } catch (e) {
      alert("Gagal membuat file: " + (e?.message || "kesalahan tak terduga"));
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));

  return (
    <section>
      {onBack && (
        <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ marginBottom: 8 }}>
          ← Kembali ke rekap bawahan
        </button>
      )}

      {data?.owner && !perms.isOwner && (
        <div className="log-owner">
          <b>{data.owner.name}</b>
          <span className="muted-sm">
            {data.owner.position
              ? `${data.owner.position.name} · ${data.owner.position.bidang}`
              : "Belum ada jabatan"}
          </span>
        </div>
      )}

      <LogWeekNav week={week} setWeek={setWeek} />

      {error && <div className="alert alert-error">{error}</div>}

      {loading && !data ? (
        <div className="empty">Memuat logbook...</div>
      ) : data ? (
        <>
          {/* Status persetujuan */}
          <div className={`approval-bar ${locked ? "ok" : "wait"}`}>
            <div>
              {locked ? (
                <>
                  ✅ <b>Disetujui</b> oleh {approval.approvedBy?.name || "-"} ·{" "}
                  {formatDate(approval.approvedAt)}
                  <div className="muted-sm">
                    🔒 Terkunci. Hanya Direktur/Wadir terkait yang dapat mengubah.
                  </div>
                </>
              ) : (
                <>
                  ⏳ <b>Belum disetujui</b>
                  <div className="muted-sm">
                    {perms.approverNames?.length
                      ? `Atasan langsung: ${perms.approverNames.join(", ")}`
                      : "Tidak ada atasan langsung yang perlu menyetujui."}
                  </div>
                </>
              )}
            </div>
            <div className="row-actions">
              {!locked && perms.canApprove && (
                <button
                  className="btn btn-sm btn-primary"
                  onClick={approve}
                  disabled={busy || entries.length === 0}
                  title={entries.length === 0 ? "Belum ada kegiatan" : ""}
                >
                  ✓ Setujui minggu ini
                </button>
              )}
              {locked && perms.canOverride && (
                <button className="btn btn-sm" onClick={unapprove} disabled={busy}>
                  Batalkan persetujuan
                </button>
              )}
            </div>
          </div>

          {/* Ringkasan minggu */}
          <div className="log-summary">
            <div className="stat">
              <div className="num">{entries.length}</div>
              <div className="lbl">Kegiatan</div>
            </div>
            <div className="stat">
              <div className="num" style={{ color: "var(--primary)" }}>
                {formatMinutes(totalMinutes)}
              </div>
              <div className="lbl">Total waktu</div>
            </div>
            <div className="log-cats">
              {byCategory.length === 0 ? (
                <span className="muted-sm">Belum ada kegiatan minggu ini.</span>
              ) : (
                byCategory.map((c) => (
                  <span key={c.category} className="chip">
                    {c.category} · <b>{formatMinutes(c.minutes)}</b>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="log-toolbar">
            {canAdd && (
              <button
                className="btn btn-primary"
                onClick={() => setModal({ date: today <= addDays(week, 6) ? today : week })}
              >
                + Tambah kegiatan
              </button>
            )}
            <div className="spacer" />
            <select value={exportPeriod} onChange={(e) => setExportPeriod(e.target.value)}>
              <option value="week">Periode: minggu ini</option>
              <option value="month">Periode: 1 bulan penuh</option>
            </select>
            <button className="btn btn-sm" onClick={() => exportAs("csv")}>
              ⬇ CSV
            </button>
            <button className="btn btn-sm" onClick={() => exportAs("pdf")}>
              🖨 PDF
            </button>
          </div>

          {/* Per hari */}
          {days.map((d, i) => {
            const list = entries.filter((e) => e.date === d);
            const mins = list.reduce((s, e) => s + e.minutes, 0);
            const future = d > today;
            return (
              <div key={d} className={`day-block ${d === today ? "is-today" : ""}`}>
                <div className="day-head">
                  <b>{DAY_NAMES[i]}</b>
                  <span className="muted-sm">{formatDayKey(d, false)}</span>
                  {d === today && <span className="badge badge-staff">Hari ini</span>}
                  <div className="spacer" />
                  {mins > 0 && <span className="muted-sm">{formatMinutes(mins)}</span>}
                  {canAdd && !future && (
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => setModal({ date: d })}
                      title="Tambah kegiatan di hari ini"
                    >
                      +
                    </button>
                  )}
                </div>
                {list.length === 0 ? (
                  <div className="day-empty muted-sm">
                    {future ? "—" : i < 5 ? "Belum ada kegiatan" : "Tidak ada kegiatan"}
                  </div>
                ) : (
                  list.map((e) => (
                    <div key={e.id} className="log-item">
                      <div className="log-time">
                        <b>
                          {e.startTime}–{e.endTime}
                        </b>
                        <small>{formatMinutes(e.minutes)}</small>
                      </div>
                      <div className="log-body">
                        <span className="chip">{e.category}</span>
                        <div className="log-desc">{e.description}</div>
                        {e.output && (
                          <div className="muted-sm">
                            <b>Hasil:</b> {e.output}
                          </div>
                        )}
                        <div className="log-links">
                          {e.task && <span className="muted-sm">📌 {e.task.title}</span>}
                          {e.evidenceUrl && (
                            <a href={e.evidenceUrl} target="_blank" rel="noopener noreferrer">
                              🔗 Lihat bukti
                            </a>
                          )}
                        </div>
                      </div>
                      {canEdit && (
                        <div className="log-actions">
                          <button className="btn btn-sm" onClick={() => setModal({ entry: e })}>
                            Ubah
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(e)}>
                            Hapus
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            );
          })}
        </>
      ) : null}

      {modal && (
        <LogEntryModal
          entry={modal.entry || null}
          defaultDate={modal.date}
          ownerId={userId}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </section>
  );
}
