"use client";

import { useState, useEffect, useCallback } from "react";
import { StatusChip } from "@/components/PerfCharts";
import { todayKey } from "@/lib/logdate";
import { makePeriod, monthOfWeek, targetStatus, STATUS_TEXT, fmt, MONTHS } from "@/lib/perfcalc";

// Bagian "Kamar Operasi (IBP)" di Performa RS: data otomatis dari aplikasi
// Jadwal Operasi — jumlah operasi elektif, indikator mutu, dan rekap per KSM.
// Beberapa bulan (triwulan/semester/tahun) dijumlahkan; persentase dihitung
// ulang dari total pembilang/penyebut.

const INM_TUNDA = { targetOp: "LTE", target: 5 };
const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const fmtPct = (v) => (v === null ? "—" : `${fmt(v, 1)}%`);
const OUTCOME = { DILAKSANAKAN: "Dilaksanakan", TUNDA: "Ditunda", BATAL: "Batal", BELUM: "Belum diupdate" };
const fmtDate = (d) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) : "—");

function monthsOf(gran, key) {
  if (gran === "week") return [monthOfWeek(key)];
  const p = makePeriod(gran === "multi" ? "year" : gran, key);
  const cur = todayKey().slice(0, 7);
  return p.months.filter((m) => m <= cur);
}

function combine(reports) {
  const sum = { terjadwal: 0, dilaksanakan: 0, tepatWaktu: 0, terlambat: 0, ditunda: 0, batal: 0, odc: 0, belumDiupdate: 0 };
  const ratio = () => ({ n: 0, d: 0 });
  const mutu = { tunda: ratio(), batal: ratio(), ubah: ratio(), mulai: ratio(), util: ratio() };
  let waitW = 0;
  let waitN = 0;
  const ksm = new Map();
  const unknown = [];
  let unknownNoDetail = 0;
  for (const { data: r } of reports) {
    if (Array.isArray(r.ksmBelumDiketahui)) unknown.push(...r.ksmBelumDiketahui);
    else unknownNoDetail += (r.perKsm || []).filter((k) => /belum diketahui/i.test(k.ksm)).reduce((a, k) => a + (k.terjadwal || 0), 0);
    for (const k of Object.keys(sum)) sum[k] += r.jumlah?.[k] || 0;
    const add = (t, x, n = "pembilang", d = "penyebut") => {
      if (!x) return;
      t.n += x[n] || 0;
      t.d += x[d] || 0;
    };
    add(mutu.tunda, r.mutu?.penundaanElektif);
    add(mutu.batal, r.mutu?.pembatalan);
    add(mutu.ubah, r.mutu?.perubahanJadwal);
    add(mutu.mulai, r.mutu?.mulaiOperasiPertama);
    add(mutu.util, r.mutu?.utilisasi, "menitTerpakai", "menitTersedia");
    const w = r.mutu?.waktuTunggu;
    if (w?.medianHari != null && w.n) {
      waitW += w.medianHari * w.n;
      waitN += w.n;
    }
    for (const k of r.perKsm || []) {
      const cur = ksm.get(k.ksm) || { ksm: k.ksm, terjadwal: 0, dilaksanakan: 0, tepatWaktu: 0, ditunda: 0, batal: 0 };
      for (const f of ["terjadwal", "dilaksanakan", "tepatWaktu", "ditunda", "batal"]) cur[f] += k[f] || 0;
      ksm.set(k.ksm, cur);
    }
  }
  return {
    sum,
    mutu,
    wait: waitN ? waitW / waitN : null,
    ksm: [...ksm.values()].sort((a, b) => b.dilaksanakan - a.dilaksanakan || b.terjadwal - a.terjadwal),
    unknown: unknown.sort((a, b) => String(a.tanggal).localeCompare(String(b.tanggal))),
    unknownNoDetail,
  };
}

export default function OkSection({ gran, periodKey }) {
  const [state, setState] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const months = monthsOf(gran, periodKey);
  const from = months[0];
  const to = months.at(-1);

  const load = useCallback(async () => {
    if (!from) return setState({ reports: [], configured: true, canSync: false });
    try {
      const res = await fetch(`/api/performa/jadwal-operasi?from=${from}&to=${to}`);
      const d = await res.json();
      setState(res.ok ? d : { reports: [], error: d.error });
    } catch {
      setState({ reports: [], error: "Tidak dapat terhubung ke server." });
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function sync() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/performa/jadwal-operasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to }),
      });
      const d = await res.json();
      if (!res.ok && !d.ok) setMsg(d.error || d.failed?.[0]?.error || "Gagal menarik data.");
      else if (d.failed?.length) setMsg(`Sebagian gagal: ${d.failed.map((f) => `${monthLabel(f.bulan)} (${f.error})`).join(", ")}`);
      else setMsg(`Berhasil menarik ${d.ok.length} bulan.`);
      await load();
    } catch {
      setMsg("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  if (!state) return null;
  const reports = state.reports || [];
  const have = new Set(reports.map((r) => r.month));
  const missing = months.filter((m) => !have.has(m));
  const provisional = reports.some((r) => !r.final);
  const last = reports.reduce((m, r) => (!m || r.fetchedAt > m ? r.fetchedAt : m), null);
  const c = combine(reports);
  const inmV = pct(c.mutu.tunda.n, c.mutu.tunda.d);
  const inmS = targetStatus(INM_TUNDA, inmV);
  const maxKsm = Math.max(1, ...c.ksm.map((k) => k.dilaksanakan));

  return (
    <section className="pf-card wide ok-card">
      <h3 className="ct">G. Kamar Operasi (IBP) — operasi elektif</h3>
      <p className="cs">
        Otomatis dari aplikasi Jadwal Operasi · {months.length > 1 ? `${monthLabel(from)} – ${monthLabel(to)}` : from ? monthLabel(from) : "—"}
        {gran === "week" && " (bulan dari minggu terpilih)"}
        {provisional && <span className="ok-prov"> · data sementara (bulan berjalan)</span>}
        {last && ` · ditarik ${new Date(last).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`}
      </p>
      {state.canSync && (
        <div className="row-actions" style={{ marginBottom: 8 }}>
          <button className="btn btn-sm" onClick={sync} disabled={busy || !from}>
            {busy ? "Menarik..." : "⟳ Tarik sekarang"}
          </button>
          {msg && <span className="muted-sm">{msg}</span>}
        </div>
      )}
      {!state.configured && reports.length === 0 ? (
        <p className="muted-sm">Integrasi dengan aplikasi Jadwal Operasi belum diaktifkan (pengaturan Vercel).</p>
      ) : reports.length === 0 ? (
        <p className="muted-sm">Belum ada data untuk periode ini.{state.canSync ? " Klik “Tarik sekarang”." : ""}</p>
      ) : (
        <>
          {missing.length > 0 && <p className="muted-sm">Belum ada data: {missing.map(monthLabel).join(", ")}.</p>}
          <div className="ok-tiles">
            {[
              ["Terjadwal", c.sum.terjadwal],
              ["Dilaksanakan", c.sum.dilaksanakan],
              ["Ditunda", c.sum.ditunda],
              ["Batal", c.sum.batal],
              ["Pasien ODC", c.sum.odc],
            ].map(([l, n]) => (
              <div key={l} className="ok-tile">
                <b>{fmt(n, 0)}</b>
                <span>{l}</span>
              </div>
            ))}
          </div>
          {c.sum.belumDiupdate > 0 && (
            <p className="muted-sm">⚠ {c.sum.belumDiupdate} jadwal belum diupdate realisasinya di aplikasi Jadwal Operasi.</p>
          )}

          <div className="ok-cols">
            <div>
              <h4 className="pf-sub">Indikator mutu</h4>
              <table className="t2">
                <thead><tr><th>Indikator</th><th className="n">Capaian</th><th className="n">Pemb. / peny.</th><th>Status</th></tr></thead>
                <tbody>
                  <tr>
                    <td>Penundaan operasi elektif (INM, target ≤ 5%)</td>
                    <td className="n"><b>{fmtPct(inmV)}</b></td>
                    <td className="n muted-sm">{c.mutu.tunda.n} / {c.mutu.tunda.d}</td>
                    <td><StatusChip status={inmS} text={STATUS_TEXT[inmS]} /></td>
                  </tr>
                  {[
                    ["Angka pembatalan", c.mutu.batal],
                    ["Angka perubahan jadwal", c.mutu.ubah],
                    ["Ketepatan mulai operasi pertama", c.mutu.mulai],
                  ].map(([l, x]) => (
                    <tr key={l}>
                      <td>{l}</td>
                      <td className="n"><b>{fmtPct(pct(x.n, x.d))}</b></td>
                      <td className="n muted-sm">{x.n} / {x.d}</td>
                      <td />
                    </tr>
                  ))}
                  <tr>
                    <td>Waktu tunggu operasi (median)</td>
                    <td className="n"><b>{c.wait === null ? "—" : `${fmt(c.wait, 1)} hari`}</b></td>
                    <td className="n muted-sm">{months.length > 1 ? "rerata bulanan" : ""}</td>
                    <td />
                  </tr>
                  <tr>
                    <td>Utilisasi kapasitas tim</td>
                    <td className="n"><b>{fmtPct(pct(c.mutu.util.n, c.mutu.util.d))}</b></td>
                    <td className="n muted-sm">{fmt(c.mutu.util.n / 60, 0)} / {fmt(c.mutu.util.d / 60, 0)} jam</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <div>
              <h4 className="pf-sub">Operasi dilaksanakan per KSM</h4>
              <div className="ok-bars">
                {c.ksm.map((k) => (
                  <div key={k.ksm} className="ok-bar" title={`${k.ksm}: ${k.dilaksanakan} dilaksanakan dari ${k.terjadwal} terjadwal`}>
                    <span className="ok-bar-l">{k.ksm}</span>
                    <span className="ok-bar-track">
                      <span className="ok-bar-fill" style={{ width: `${(k.dilaksanakan / maxKsm) * 100}%` }} />
                    </span>
                    <b className="ok-bar-v">{k.dilaksanakan}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h4 className="pf-sub">Rekap per KSM</h4>
          <div className="table-wrap">
            <table className="t2">
              <thead>
                <tr><th>KSM</th><th className="n">Terjadwal</th><th className="n">Dilaksanakan</th><th className="n">Tepat waktu</th><th className="n">Ditunda</th><th className="n">Batal</th></tr>
              </thead>
              <tbody>
                {c.ksm.map((k) => (
                  <tr key={k.ksm}>
                    <td>{k.ksm}</td>
                    <td className="n">{k.terjadwal}</td>
                    <td className="n"><b>{k.dilaksanakan}</b></td>
                    <td className="n">{k.tepatWaktu}</td>
                    <td className="n">{k.ditunda}</td>
                    <td className="n">{k.batal}</td>
                  </tr>
                ))}
                <tr className="ok-total">
                  <td>Total</td>
                  <td className="n">{c.sum.terjadwal}</td>
                  <td className="n">{c.sum.dilaksanakan}</td>
                  <td className="n">{c.sum.tepatWaktu}</td>
                  <td className="n">{c.sum.ditunda}</td>
                  <td className="n">{c.sum.batal}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {(c.unknown.length > 0 || c.unknownNoDetail > 0) && (
            <div className="ok-unknown">
              <h4 className="pf-sub">⚠ Operasi dengan KSM belum diketahui ({c.unknown.length || c.unknownNoDetail})</h4>
              {c.unknown.length > 0 ? (
                <>
                  <div className="table-wrap">
                    <table className="t2">
                      <thead>
                        <tr><th>Tanggal</th><th>No. permintaan</th><th>DPJP</th><th>Rencana tindakan</th><th>Unit pengirim</th><th>Status</th></tr>
                      </thead>
                      <tbody>
                        {c.unknown.map((u) => (
                          <tr key={u.nomor}>
                            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(u.tanggal)}</td>
                            <td className="muted-sm">{u.nomor}</td>
                            <td>
                              {u.dpjp}
                              {u.diDaftarDokter === false && <div className="muted-sm">belum ada di Daftar Dokter</div>}
                            </td>
                            <td>{u.tindakan}</td>
                            <td>{u.unit}</td>
                            <td>{OUTCOME[u.status] || u.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="muted-sm" style={{ marginTop: 6 }}>
                    Cara melengkapi: di aplikasi Jadwal Operasi buka <b>Master → Daftar Dokter</b>, pilih KSM untuk DPJP di atas (tambahkan
                    dokternya bila belum ada, dengan nama yang sama persis), lalu klik <b>⟳ Tarik sekarang</b> di sini.
                  </p>
                </>
              ) : (
                <p className="muted-sm">
                  Rincian belum tersedia untuk data yang ditarik sebelumnya.{state.canSync ? " Klik “⟳ Tarik sekarang” untuk memuatnya." : ""}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
