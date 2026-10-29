"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import TopBar from "@/components/TopBar";
import { BarChart, LineChart, Legend, StatusChip, ChartScroll } from "@/components/PerfCharts";
import { ROLES } from "@/lib/constants";
import { todayKey, formatWeekRange } from "@/lib/logdate";
import {
  GRANS,
  GRAN_LABELS,
  MONTHS,
  BJ_DEFS,
  currentPeriodKey,
  shiftPeriod,
  targetStatus,
  targetLabel,
  bjStatus,
  formatParam,
  formatBJ,
  fmt,
  pctChange,
  STATUS_TEXT,
  BJ_STATUS_TEXT,
} from "@/lib/perfcalc";
import { downloadPerformaCsv, generatePerformaPdf } from "@/lib/performaExport";

const BJ = Object.fromEntries(BJ_DEFS.map((d) => [d.code, d]));
const INSIDEN = ["ktd", "knc", "ktc", "kpc", "sentinel"];

function Delta({ cur, prev, prevLabel }) {
  const d = pctChange(cur, prev);
  if (d === null) return <span className="muted-sm">belum ada pembanding</span>;
  return (
    <span className="muted-sm">
      {d >= 0 ? "▲" : "▼"} {fmt(Math.abs(d), 1)}% vs {prevLabel}
    </span>
  );
}

export default function PerformaDashboard({ currentUser }) {
  const [gran, setGran] = useState("month");
  const [period, setPeriod] = useState(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null); // kode indikator yang dibuka

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/performa?gran=${gran}${period ? `&period=${period}` : ""}`);
      const d = await res.json();
      if (res.ok) setData(d);
      else setError(d.error || "Gagal memuat data performa.");
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setLoading(false);
    }
  }, [gran, period]);

  useEffect(() => {
    load();
  }, [load]);

  const baseGran = gran === "multi" ? "year" : gran;
  const key = data?.period?.key;
  const latestKey = currentPeriodKey(baseGran, todayKey());
  const params = data?.params || [];
  const pmap = Object.fromEntries(params.map((p) => [p.code, p]));
  const cur = data?.current || {};
  const prev = data?.previousValues || {};
  const v = (code) => cur[code]?.v ?? null;
  const pv = (code) => prev[code]?.v ?? null;
  const show = (code) => (BJ[code] ? formatBJ(code, v(code)) : pmap[code] ? formatParam(pmap[code], v(code)) : "—");
  // Periode berjalan dibandingkan dengan rentang bulan yang sama (lihat API).
  const prevShort = !data
    ? ""
    : data.previous.label.includes("rentang yang sama")
      ? data.previous.label.replace(" (rentang yang sama)", "")
      : data.trend.periods.at(-2)?.short || data.previous.label;
  const hasAny = Boolean(data?.lastWeek || data?.lastMonth);

  const groupParams = (g) => params.filter((p) => p.group === g);
  const inmParams = groupParams("C").filter((p) => p.target !== null);
  const inmStatus = inmParams.map((p) => targetStatus(p, v(p.code))).filter(Boolean);
  const insidenTotal = (vals) =>
    INSIDEN.reduce((s, c) => (vals[c]?.v !== null && vals[c]?.v !== undefined ? (s ?? 0) + vals[c].v : s), null);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="pf-head">
          <h2>📈 Performa RS</h2>
          {data && (
            <span className="muted-sm">
              Data terakhir: {data.lastWeek ? `minggu ${formatWeekRange(data.lastWeek)}` : "—"} · bulanan:{" "}
              {data.lastMonth ? `${MONTHS[Number(data.lastMonth.slice(5, 7)) - 1]} ${data.lastMonth.slice(0, 4)}` : "—"}
            </span>
          )}
          <div className="spacer" />
          {data?.canInput && (
            <Link href="/performa/input" className="btn btn-primary btn-sm">
              ✏ Input / impor data
            </Link>
          )}
          {currentUser.role === ROLES.ADMIN && (
            <Link href="/performa/parameter" className="btn btn-sm">
              ⚙ Parameter
            </Link>
          )}
        </div>

        {/* Filter: satu baris di atas semua grafik */}
        <div className="pf-filters">
          <div className="seg">
            {GRANS.map((g) => (
              <button
                key={g}
                className={g === gran ? "on" : ""}
                onClick={() => {
                  setGran(g);
                  setPeriod(null);
                }}
              >
                {GRAN_LABELS[g]}
              </button>
            ))}
          </div>
          {data && (
            <div className="pf-period">
              <button className="btn btn-sm" onClick={() => setPeriod(shiftPeriod(baseGran, key, -1))} aria-label="Periode sebelumnya">
                ‹
              </button>
              <b>{gran === "multi" ? `${Number(key) - (data.multiYear.years.length - 1)}–${key}` : data.period.label}</b>
              <button
                className="btn btn-sm"
                onClick={() => setPeriod(shiftPeriod(baseGran, key, 1))}
                disabled={key >= latestKey}
                aria-label="Periode berikutnya"
              >
                ›
              </button>
              {gran !== "multi" && <span className="muted-sm">dibanding {data.previous.label}</span>}
            </div>
          )}
          <div className="spacer" />
          {data && hasAny && (
            <>
              <button className="btn btn-sm" onClick={() => downloadPerformaCsv(data)}>
                ⬇ CSV
              </button>
              <button
                className="btn btn-sm"
                onClick={() => generatePerformaPdf(data).catch((e) => alert("Gagal membuat PDF: " + e.message))}
              >
                🖨 PDF
              </button>
            </>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && !data && <div className="empty">Memuat data performa...</div>}

        {data && !hasAny && (
          <div className="empty">
            <div className="big">📊</div>
            <p>Belum ada data performa.</p>
            {data.canInput ? (
              <Link href="/performa/input" className="btn btn-primary">
                Input atau impor data
              </Link>
            ) : (
              <p className="muted-sm">Data akan tampil setelah Admin/Subadmin menginput data.</p>
            )}
          </div>
        )}

        {data && hasAny && (
          <div style={{ opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
            {gran === "week" && (
              <p className="muted-sm" style={{ marginTop: -4 }}>
                Indikator mutu (INM) &amp; kepuasan diinput bulanan — yang tampil adalah data bulan dari minggu ini.
              </p>
            )}
            <div className="kpis">
              <div className="kpi">
                <div className="k-lbl">Kunjungan rawat jalan</div>
                <div className="k-num">{show("rajal")}</div>
                <div className="k-sub"><Delta cur={v("rajal")} prev={pv("rajal")} prevLabel={prevShort} /></div>
              </div>
              <div className="kpi">
                <div className="k-lbl">Kunjungan IGD</div>
                <div className="k-num">{show("igd")}</div>
                <div className="k-sub"><Delta cur={v("igd")} prev={pv("igd")} prevLabel={prevShort} /></div>
              </div>
              {["bor", "alos"].map((c) => (
                <div className="kpi" key={c}>
                  <div className="k-lbl">{BJ[c].name}</div>
                  <div className="k-num">{show(c)}</div>
                  <div className="k-sub">
                    <StatusChip status={bjStatus(BJ[c], v(c))} text={`Ideal ${BJ[c].ideal}`} />
                  </div>
                </div>
              ))}
              {["inm_hh", "kepuasan"].filter((c) => pmap[c]).map((c) => (
                <div className="kpi" key={c}>
                  <div className="k-lbl">{c === "inm_hh" ? "Kepatuhan kebersihan tangan" : "Kepuasan pasien"}</div>
                  <div className="k-num">{show(c)}</div>
                  <div className="k-sub">
                    <StatusChip status={targetStatus(pmap[c], v(c))} text={`Target ${targetLabel(pmap[c])}`} />
                  </div>
                </div>
              ))}
              <div className="kpi">
                <div className="k-lbl">INM memenuhi target</div>
                <div className="k-num">
                  {inmStatus.length ? `${inmStatus.filter((s) => s === "good").length} / ${inmStatus.length}` : "—"}
                </div>
                <div className="k-sub">
                  {inmStatus.includes("warn") && (
                    <StatusChip status="warn" text={`${inmStatus.filter((s) => s === "warn").length} mendekati`} />
                  )}
                  {inmStatus.includes("crit") && (
                    <StatusChip status="crit" text={`${inmStatus.filter((s) => s === "crit").length} di bawah`} />
                  )}
                </div>
              </div>
              <div className="kpi">
                <div className="k-lbl">Insiden keselamatan</div>
                <div className="k-num">{fmt(insidenTotal(cur), 0)}</div>
                <div className="k-sub">
                  <span className="muted-sm">
                    KTD {fmt(v("ktd"), 0)} · Sentinel {fmt(v("sentinel"), 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="pf-grid">
              <section className="pf-card">
                <h3 className="ct">Kunjungan rawat jalan</h3>
                <p className="cs">
                  {GRAN_LABELS[gran]} · {data.trend.periods[0]?.short} – {data.trend.periods.at(-1)?.short}
                  {gran === "month" && " · tiap bulan berisi 4–5 minggu (minggu ikut bulan hari Kamisnya)"}
                </p>
                <ChartScroll>
                  <BarChart
                    labels={data.trend.periods.map((p) => p.short)}
                    values={data.trend.series.rajal || []}
                    fmt={(x) => fmt(x, 0)}
                  />
                </ChartScroll>
              </section>
              <section className="pf-card">
                <h3 className="ct">BOR</h3>
                <p className="cs">Area biru muda = rentang ideal 60–85%</p>
                <ChartScroll>
                  <LineChart
                    labels={data.trend.periods.map((p) => p.short)}
                    series={[{ name: "BOR", values: data.trend.series.bor || [] }]}
                    fmt={(x) => `${fmt(x, 1)}%`}
                    fmtAxis={(x) => `${fmt(x, 0)}%`}
                    band={{ min: 60, max: 85, label: "Rentang ideal 60–85%" }}
                  />
                </ChartScroll>
              </section>
              <section className="pf-card wide">
                <h3 className="ct">Multi-tahun: kunjungan rawat jalan per bulan</h3>
                <p className="cs">Klik indikator di tabel bawah untuk perbandingan multi-tahun indikator lain</p>
                {data.multiYear.years.length > 1 && <Legend items={data.multiYear.years.map(String)} />}
                <ChartScroll wide>
                  <LineChart
                    width={1100}
                    labels={MONTHS}
                    series={data.multiYear.years.map((y) => ({ name: String(y), values: data.multiYear.values.rajal?.[y] || [] }))}
                    fmt={(x) => fmt(x, 0)}
                  />
                </ChartScroll>
              </section>

              <section className="pf-card">
                <h3 className="ct">A. Volume pelayanan</h3>
                <p className="cs">{data.period.label}</p>
                <table className="t2 clickable">
                  <thead><tr><th>Parameter</th><th className="n">Nilai</th><th className="n">Sebelumnya</th><th className="n">Perubahan</th></tr></thead>
                  <tbody>
                    {groupParams("A").map((p) => {
                      const d = pctChange(v(p.code), pv(p.code));
                      return (
                        <tr key={p.code} onClick={() => setDetail(p.code)}>
                          <td>{p.name}</td>
                          <td className="n">{show(p.code)}</td>
                          <td className="n">{formatParam(p, pv(p.code))}</td>
                          <td className="n muted-sm">{d === null ? "—" : `${d >= 0 ? "▲" : "▼"} ${fmt(Math.abs(d), 1)}%`}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="pf-card">
                <h3 className="ct">B. Efisiensi rawat inap (Barber-Johnson)</h3>
                <p className="cs">{data.period.label}</p>
                <table className="t2 clickable">
                  <thead><tr><th>Indikator</th><th className="n">Nilai</th><th>Ideal</th><th>Status</th></tr></thead>
                  <tbody>
                    {BJ_DEFS.map((d) => {
                      const s = bjStatus(d, v(d.code));
                      return (
                        <tr key={d.code} onClick={() => setDetail(d.code)}>
                          <td title={d.desc}>{d.name}</td>
                          <td className="n">{show(d.code)}</td>
                          <td>{d.ideal}</td>
                          <td><StatusChip status={s} text={BJ_STATUS_TEXT[s]} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>

              <section className="pf-card wide">
                <h3 className="ct">C. Indikator Nasional Mutu</h3>
                <p className="cs">{gran === "week" ? "Data bulan berjalan" : data.period.label} · klik indikator untuk melihat tren</p>
                <div className="table-wrap">
                  <table className="t2 clickable">
                    <thead><tr><th>Indikator</th><th className="n">Capaian</th><th className="n">Pembilang / penyebut</th><th>Target</th><th>Status</th></tr></thead>
                    <tbody>
                      {groupParams("C").map((p) => {
                        const s = targetStatus(p, v(p.code));
                        const c = cur[p.code];
                        return (
                          <tr key={p.code} onClick={() => setDetail(p.code)}>
                            <td>{p.name}</td>
                            <td className="n"><b>{show(p.code)}</b></td>
                            <td className="n muted-sm">
                              {p.kind === "RATIO" && c ? `${fmt(c.num, 0)} / ${fmt(c.den, 0)}` : p.kind === "SCORE" && c?.den ? `${fmt(c.den, 0)} responden` : "—"}
                            </td>
                            <td>{targetLabel(p)}</td>
                            <td><StatusChip status={s} text={STATUS_TEXT[s]} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="pf-card">
                <h3 className="ct">D. Insiden keselamatan pasien</h3>
                <p className="cs">{data.period.label}</p>
                <table className="t2 clickable">
                  <thead><tr><th>Jenis</th><th className="n">Jumlah</th><th className="n">Sebelumnya</th></tr></thead>
                  <tbody>
                    {groupParams("D").map((p) => (
                      <tr key={p.code} onClick={() => setDetail(p.code)}>
                        <td>{p.name}</td>
                        <td className="n">{show(p.code)}</td>
                        <td className="n">{formatParam(p, pv(p.code))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {params.some((p) => !["A", "B", "C", "D"].includes(p.group)) && (
                <section className="pf-card">
                  <h3 className="ct">Parameter lainnya</h3>
                  <p className="cs">{data.period.label}</p>
                  <table className="t2 clickable">
                    <thead><tr><th>Parameter</th><th className="n">Nilai</th><th>Target</th><th>Status</th></tr></thead>
                    <tbody>
                      {params.filter((p) => !["A", "B", "C", "D"].includes(p.group)).map((p) => {
                        const s = targetStatus(p, v(p.code));
                        return (
                          <tr key={p.code} onClick={() => setDetail(p.code)}>
                            <td>{p.name}</td>
                            <td className="n">{show(p.code)}</td>
                            <td>{targetLabel(p)}</td>
                            <td><StatusChip status={s} text={STATUS_TEXT[s]} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </section>
              )}
            </div>
          </div>
        )}
      </main>

      {detail && data && (
        <DetailModal code={detail} data={data} gran={gran} pmap={pmap} onClose={() => setDetail(null)} />
      )}
    </>
  );
}

// Detail satu indikator: tren, perbandingan multi-tahun, dan tabel data.
function DetailModal({ code, data, gran, pmap, onClose }) {
  const bj = BJ[code];
  const p = pmap[code];
  const name = bj ? `${bj.name} — ${bj.desc}` : p?.name;
  const f = (x) => (bj ? formatBJ(code, x) : formatParam(p, x));
  const labels = data.trend.periods.map((x) => x.short);
  const values = data.trend.series[code] || [];
  const isBar = p && (p.kind === "COUNT" || p.kind === "STOCK");
  const target = p && p.target !== null ? { value: p.target, label: `Target ${targetLabel(p)}` } : null;
  const band = bj && bj.min !== null ? { min: bj.min, max: bj.max, label: `Ideal ${bj.ideal}` } : null;
  const years = data.multiYear.years;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="dash-card-head">
          <h3 style={{ margin: 0 }}>{name}</h3>
          <button className="btn btn-sm" onClick={onClose}>Tutup</button>
        </div>
        {p?.source && <p className="muted-sm">Sumber data: {p.source}</p>}

        <h4 className="pf-sub">Tren {GRAN_LABELS[gran].toLowerCase()}</h4>
        <ChartScroll>
          {isBar ? (
            <BarChart width={800} labels={labels} values={values} fmt={f} />
          ) : (
            <LineChart width={800} labels={labels} series={[{ name, values }]} fmt={f} band={band} target={target} />
          )}
        </ChartScroll>

        <h4 className="pf-sub">Perbandingan multi-tahun (per bulan)</h4>
        {years.length > 1 && <Legend items={years.map(String)} />}
        <ChartScroll>
          <LineChart
            width={800}
            labels={MONTHS}
            series={years.map((y) => ({ name: String(y), values: data.multiYear.values[code]?.[y] || [] }))}
            fmt={f}
            band={band}
            target={target}
          />
        </ChartScroll>

        <h4 className="pf-sub">Tabel data</h4>
        <div className="table-wrap">
          <table className="t2">
            <thead><tr><th>Periode</th><th className="n">Nilai</th></tr></thead>
            <tbody>
              {data.trend.periods.map((per, i) => (
                <tr key={per.key}><td>{per.label}</td><td className="n">{f(values[i] ?? null)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
