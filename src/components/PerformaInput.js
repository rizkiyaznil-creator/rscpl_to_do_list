"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { StatusChip } from "@/components/PerfCharts";
import { PERF_GROUPS } from "@/lib/constants";
import { todayKey, weekStartKey, addDays, formatWeekRange } from "@/lib/logdate";
import {
  PERF_GROUP_ORDER,
  BJ_DEFS,
  aggregate,
  makePeriod,
  parseNumberLoose,
  targetStatus,
  targetLabel,
  bjStatus,
  formatBJ,
  fmt,
  STATUS_TEXT,
  BJ_STATUS_TEXT,
  MONTHS,
} from "@/lib/perfcalc";

const str = (x) => (x === null || x === undefined ? "" : String(x).replace(".", ","));
const monthLabel = (start) => `${MONTHS[Number(start.slice(5, 7)) - 1]} ${start.slice(0, 4)}`;

export default function PerformaInput({ currentUser }) {
  const today = todayKey();
  const [type, setType] = useState("WEEK");
  const [start, setStart] = useState(() => weekStartKey(today));
  const [data, setData] = useState(null);
  const [form, setForm] = useState({});
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState([]);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setErrors([]);
    try {
      const res = await fetch(`/api/performa/input?type=${type}&start=${start}`);
      const d = await res.json();
      if (!res.ok) {
        setErrors([d.error || "Gagal memuat data."]);
        return;
      }
      setData(d);
      const f = {};
      for (const p of d.params) {
        const val = d.values[p.code] || {};
        f[p.code] = { value: str(val.value), num: str(val.num), den: str(val.den) };
      }
      setForm(f);
      setDirty(false);
    } catch {
      setErrors(["Tidak dapat terhubung ke server."]);
    }
  }, [type, start]);

  useEffect(() => {
    load();
  }, [load]);

  function go(nextType, nextStart) {
    if (dirty && !confirm("Perubahan belum disimpan. Pindah periode dan buang perubahan?")) return;
    setMsg("");
    setType(nextType);
    setStart(nextStart);
  }

  function set(code, field, value) {
    setForm((f) => ({ ...f, [code]: { ...f[code], [field]: value } }));
    setDirty(true);
    setMsg("");
  }

  async function save() {
    setSaving(true);
    setErrors([]);
    setMsg("");
    try {
      const res = await fetch("/api/performa/input", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, start, values: form }),
      });
      const d = await res.json();
      if (!res.ok) setErrors(d.errors || [d.error || "Gagal menyimpan."]);
      else {
        setMsg(`Tersimpan ✓ (${d.saved} isian)`);
        await load();
      }
    } catch {
      setErrors(["Tidak dapat terhubung ke server."]);
    } finally {
      setSaving(false);
    }
  }

  // Pratinjau hitungan dari isian form (aturan sama dengan server).
  const params = data?.params || [];
  const rows = params.map((p) => {
    const f = form[p.code] || {};
    const n = (k) => {
      const x = parseNumberLoose(f[k]);
      return Number.isFinite(x) ? x : null;
    };
    return { code: p.code, type, start, value: n("value"), num: n("num"), den: n("den") };
  });
  const preview = data ? aggregate(params, rows, makePeriod(type === "WEEK" ? "week" : "month", type === "WEEK" ? start : start.slice(0, 7))) : {};
  const groups = PERF_GROUP_ORDER.filter((g) => params.some((p) => p.group === g));
  const curWeek = weekStartKey(today);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="pf-head">
          <Link href="/performa" className="btn btn-sm btn-ghost">
            ← Performa RS
          </Link>
          <h2>📊 Input Data Performa RS</h2>
          <div className="seg">
            <button className={type === "WEEK" ? "on" : ""} onClick={() => go("WEEK", curWeek)}>
              Mingguan
            </button>
            <button className={type === "MONTH" ? "on" : ""} onClick={() => go("MONTH", `${today.slice(0, 7)}-01`)}>
              Bulanan
            </button>
          </div>
          <div className="spacer" />
          {type === "WEEK" ? (
            <div className="pf-period">
              <button className="btn btn-sm" onClick={() => go("WEEK", addDays(start, -7))} aria-label="Minggu sebelumnya">‹</button>
              <b>{formatWeekRange(start)}</b>
              <button className="btn btn-sm" onClick={() => go("WEEK", addDays(start, 7))} disabled={start >= curWeek} aria-label="Minggu berikutnya">›</button>
            </div>
          ) : (
            <input
              type="month"
              value={start.slice(0, 7)}
              max={today.slice(0, 7)}
              onChange={(e) => e.target.value && go("MONTH", `${e.target.value}-01`)}
              style={{ width: "auto" }}
            />
          )}
        </div>

        <ImportPanel onImported={load} />

        {errors.length > 0 && (
          <div className="alert alert-error">
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        {!data ? (
          <div className="empty">Memuat formulir...</div>
        ) : (
          <>
            {groups.map((g) => {
              const ps = params.filter((p) => p.group === g);
              const sources = [...new Set(ps.map((p) => p.source).filter(Boolean))].join(" · ");
              return (
                <section key={g} className="fsec">
                  <h3>
                    {g}. {PERF_GROUPS[g]}
                  </h3>
                  {sources && <div className="src">Sumber: {sources}</div>}
                  {ps.some((p) => p.kind === "RATIO" || p.kind === "SCORE") ? (
                    <div className="table-wrap">
                      <table className="t2 inm">
                        <thead>
                          <tr><th>Indikator</th><th className="n">Pembilang / nilai</th><th className="n">Penyebut / responden</th><th className="n">Capaian</th><th>Target</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {ps.map((p) => {
                            const f = form[p.code] || {};
                            const pv = preview[p.code]?.v ?? null;
                            const s = targetStatus(p, pv);
                            const two = p.kind === "RATIO" || p.kind === "SCORE";
                            return (
                              <tr key={p.code}>
                                <td>{p.name}</td>
                                <td className="n">
                                  <input inputMode="decimal" value={two && p.kind === "RATIO" ? f.num : f.value} onChange={(e) => set(p.code, p.kind === "RATIO" ? "num" : "value", e.target.value)} aria-label={`${p.name} ${p.kind === "RATIO" ? "pembilang" : "nilai"}`} />
                                </td>
                                <td className="n">
                                  {two ? (
                                    <input inputMode="numeric" value={f.den} onChange={(e) => set(p.code, "den", e.target.value)} aria-label={`${p.name} ${p.kind === "RATIO" ? "penyebut" : "responden"}`} />
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="n"><b>{pv === null ? "—" : p.kind === "RATIO" ? `${fmt(pv, 1)}%` : fmt(pv, p.kind === "SCORE" ? 2 : 0)}</b></td>
                                <td>{targetLabel(p)}</td>
                                <td><StatusChip status={s} text={STATUS_TEXT[s]} /></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="fgrid">
                      {ps.map((p) => (
                        <div key={p.code}>
                          <label htmlFor={`f-${p.code}`}>{p.name}</label>
                          <input
                            id={`f-${p.code}`}
                            inputMode="numeric"
                            value={form[p.code]?.value ?? ""}
                            onChange={(e) => set(p.code, "value", e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {g === "B" && type === "WEEK" && (
                    <>
                      <div className="calc">
                        {BJ_DEFS.map((d) => {
                          const val = preview[d.code]?.v ?? null;
                          const s = bjStatus(d, val);
                          return (
                            <div className="c" key={d.code}>
                              <small>{d.name}</small>
                              <b>{formatBJ(d.code, val)}</b>
                              <StatusChip status={s} text={s ? `${BJ_STATUS_TEXT[s]} · ${d.ideal}` : ""} />
                            </div>
                          );
                        })}
                      </div>
                      <p className="muted-sm" style={{ margin: "8px 0 0" }}>
                        Dihitung otomatis dari isian di atas — petugas tidak perlu menghitung.
                      </p>
                    </>
                  )}
                </section>
              );
            })}

            <div className="savebar">
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? "Menyimpan..." : `Simpan data ${type === "WEEK" ? "minggu" : "bulan"} ini`}
              </button>
              {msg && <span className="pf-ok">{msg}</span>}
              {dirty && !msg && <span className="muted-sm">Ada perubahan yang belum disimpan.</span>}
              <span className="muted-sm">
                {type === "WEEK" ? formatWeekRange(start) : monthLabel(start)}
                {data.lastSaved && ` · terakhir disimpan ${data.lastSaved.by || "-"}, ${new Date(data.lastSaved.at).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`}
              </span>
            </div>
            <p className="muted-sm">Kosongkan kolom untuk menghapus data lama. Data bisa diubah kembali kapan saja.</p>
          </>
        )}
      </main>
    </>
  );
}

// Impor data masa lalu dari template Excel standar (periksa dulu, lalu impor).
function ImportPanel({ onImported }) {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");

  async function send(commit) {
    if (!file) return;
    setBusy(true);
    setDone("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch(`/api/performa/import${commit ? "?commit=1" : ""}`, { method: "POST", body: fd });
      const d = await res.json();
      if (commit && res.ok) {
        setDone(`Impor berhasil: ${d.imported.weeks} minggu & ${d.imported.months} bulan (${d.imported.cells} isian).`);
        setResult(null);
        setFile(null);
        onImported();
      } else if (!res.ok && !d.errors) {
        setResult({ ok: false, errors: [d.error || "Gagal memproses file."], errorCount: 1 });
      } else setResult(d);
    } catch {
      setResult({ ok: false, errors: ["Tidak dapat terhubung ke server."], errorCount: 1 });
    } finally {
      setBusy(false);
    }
  }

  const s = result?.summary;
  return (
    <details className="fsec import-box">
      <summary>
        <b>📥 Impor data masa lalu dari Excel</b>
        <span className="muted-sm"> — untuk mengisi banyak minggu/bulan sekaligus</span>
      </summary>
      <ol className="import-steps">
        <li>
          Unduh template standar, isi di Excel (satu baris = satu minggu / satu bulan).{" "}
          <a className="btn btn-sm" href="/api/performa/template">⬇ Unduh template Excel</a>
        </li>
        <li>
          Pilih file yang sudah diisi:{" "}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setResult(null);
              setDone("");
            }}
          />
        </li>
        <li>
          <button className="btn btn-sm" onClick={() => send(false)} disabled={!file || busy}>
            {busy && !result ? "Memeriksa..." : "Periksa file"}
          </button>{" "}
          <button
            className="btn btn-sm btn-primary"
            onClick={() => send(true)}
            disabled={!result?.ok || !s?.cells || busy}
          >
            Impor sekarang
          </button>
        </li>
      </ol>
      {done && <div className="alert alert-success">{done}</div>}
      {s && result.ok && (
        <div className="alert alert-success">
          File siap diimpor: <b>{s.weeks}</b> minggu{s.weekRange ? ` (${s.weekRange[0]} s.d. ${s.weekRange[1]})` : ""} dan{" "}
          <b>{s.months}</b> bulan{s.monthRange ? ` (${s.monthRange[0]} s.d. ${s.monthRange[1]})` : ""} — total {s.cells} isian.
          {s.overwrite > 0 && <> <b>{s.overwrite}</b> isian akan menimpa data yang sudah ada.</>}
        </div>
      )}
      {result && !result.ok && (
        <div className="alert alert-error">
          <b>{result.errorCount} kesalahan ditemukan — perbaiki file lalu periksa ulang:</b>
          <ul className="import-errors">
            {result.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          {result.errorCount > result.errors.length && <div>… dan {result.errorCount - result.errors.length} lainnya.</div>}
        </div>
      )}
    </details>
  );
}
