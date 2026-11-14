"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { todayKey } from "@/lib/logdate";
import { makePeriod, monthOfWeek, fmt, MONTHS } from "@/lib/perfcalc";

// Bagian "H. Rekam Medis" di Performa RS: ringkasan laporan bulanan Unit Rekam
// Medis untuk periode terpilih (beberapa bulan dijumlahkan).

const monthLabel = (ym) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
const pct = (n, d) => (d > 0 ? (n / d) * 100 : null);
const fmtPct = (v) => (v == null ? "—" : v > 0 && v < 0.05 ? "<0,1%" : `${fmt(v, 1)}%`);
const PENJAMIN = [
  ["bpjs", "BPJS Kesehatan", "#2a78d6"],
  ["bpjsTk", "BPJS Ketenagakerjaan", "#13a8b8"],
  ["umum", "Umum / Pribadi", "#eb6834"],
  ["asuransiLain", "Asuransi lain", "#c2489c"],
  ["jasaRaharja", "Jasa Raharja", "#e8b417"],
  ["iom", "IOM", "#8c8c8c"],
];

function monthsOf(gran, key) {
  if (gran === "week") return [monthOfWeek(key)];
  const cur = todayKey().slice(0, 7);
  return makePeriod(gran === "multi" ? "year" : gran, key).months.filter((m) => m <= cur);
}

// Gabungkan daftar {nama, jumlah} beberapa bulan (kunci: ICD bila ada, selain itu nama).
function merge(lists, keyFn = (x) => x.nama.toLowerCase()) {
  const m = new Map();
  for (const xs of lists) {
    for (const x of xs || []) {
      const k = keyFn(x);
      const cur = m.get(k) || { ...x, jumlah: 0 };
      cur.jumlah += x.jumlah || 0;
      m.set(k, cur);
    }
  }
  return [...m.values()].sort((a, b) => b.jumlah - a.jumlah);
}

function combine(reports) {
  const s = (f) => reports.reduce((a, r) => a + (f(r.data) || 0), 0);
  const pj = {};
  for (const [k] of PENJAMIN) pj[k] = s((d) => d.rj?.penjamin?.[k]);
  const keluar = (re) => s((d) => (d.igd?.caraKeluar || []).find((c) => re.test(c.nama))?.jumlah);
  return {
    rj: s((d) => d.rj?.total),
    baru: s((d) => d.rj?.baru),
    pmks: s((d) => d.rj?.pmksPpds),
    igd: s((d) => d.igd?.total),
    igdRanap: keluar(/rawat inap/i),
    igdDoa: keluar(/^DOA/i),
    igdDoe: keluar(/^DOE/i),
    ri: s((d) => d.ri?.total),
    mati: s((d) => d.ri?.meninggal),
    paps: s((d) => d.ri?.paps),
    dirujuk: s((d) => d.ri?.dirujuk),
    ibp: s((d) => d.rj?.ibp?.total),
    penjamin: pj,
    poli: merge(reports.map((r) => r.data.rj?.perPoli)),
    ruang: merge(reports.map((r) => r.data.ri?.perRuang)),
    spesialisRi: merge(reports.map((r) => r.data.ri?.perSpesialis)),
    opJenis: merge(reports.map((r) => r.data.rj?.ibp?.perJenis)),
    opSub: merge(reports.map((r) => r.data.rj?.ibp?.perSub)),
    topRj: merge(reports.map((r) => r.data.rj?.top10), (x) => (x.icd || x.nama).toLowerCase()).slice(0, 10),
    topRi: merge(reports.map((r) => r.data.ri?.top10), (x) => (x.icd || x.nama).toLowerCase()).slice(0, 10),
  };
}

function Bars({ items, max = 10 }) {
  const top = items.filter((x) => x.jumlah > 0).slice(0, max);
  const hi = Math.max(1, ...top.map((x) => x.jumlah));
  return (
    <div className="ok-bars">
      {top.map((x) => (
        <div key={x.nama} className="ok-bar" title={`${x.nama}: ${fmt(x.jumlah, 0)}`}>
          <span className="ok-bar-l">{x.nama}</span>
          <span className="ok-bar-track">
            <span className="ok-bar-fill" style={{ width: `${(x.jumlah / hi) * 100}%` }} />
          </span>
          <b className="ok-bar-v">{fmt(x.jumlah, 0)}</b>
        </div>
      ))}
      {top.length === 0 && <span className="muted-sm">—</span>}
    </div>
  );
}

function TopTable({ items }) {
  return (
    <table className="t2">
      <thead><tr><th>Diagnosis</th><th>ICD-10</th><th className="n">Kasus</th></tr></thead>
      <tbody>
        {items.map((x, i) => (
          <tr key={`${x.icd}-${x.nama}`}>
            <td>{i + 1}. {x.nama}</td>
            <td className="muted-sm">{x.icd || "—"}</td>
            <td className="n">{fmt(x.jumlah, 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function RmSection({ gran, periodKey }) {
  const [state, setState] = useState(null);
  const months = monthsOf(gran, periodKey);
  const from = months[0];
  const to = months.at(-1);

  useEffect(() => {
    if (!from) return;
    fetch(`/api/performa/rekam-medis?from=${from}&to=${to}`)
      .then((r) => r.json())
      .then((d) => setState(d))
      .catch(() => setState({ reports: [], error: "Tidak dapat terhubung ke server." }));
  }, [from, to]);

  if (!state || !from) return null;
  const reports = state.reports || [];
  const have = new Set(reports.map((r) => r.month));
  const missing = months.filter((m) => !have.has(m));
  const c = combine(reports);
  const pjTotal = Object.values(c.penjamin).reduce((a, b) => a + b, 0);
  const single = reports.length === 1 ? reports[0].data.ri : null;

  return (
    <section className="pf-card wide">
      <h3 className="ct">H. Rekam Medis</h3>
      <p className="cs">
        Laporan bulanan Unit Rekam Medis · {months.length > 1 ? `${monthLabel(from)} – ${monthLabel(to)}` : monthLabel(from)}
        {gran === "week" && " (bulan dari minggu terpilih)"}
      </p>
      {state.canUpload && (
        <div className="row-actions" style={{ marginBottom: 8 }}>
          <Link href="/performa/input" className="btn btn-sm">🏥 Unggah laporan RM</Link>
        </div>
      )}
      {reports.length === 0 ? (
        <p className="muted-sm">Belum ada laporan Rekam Medis untuk periode ini.</p>
      ) : (
        <>
          {missing.length > 0 && <p className="muted-sm">Belum ada laporan: {missing.map(monthLabel).join(", ")}.</p>}
          <div className="ok-tiles">
            {[
              ["Kunjungan rawat jalan", fmt(c.rj, 0), `${fmtPct(pct(c.baru, c.rj))} pasien baru`],
              ["Kunjungan IGD", fmt(c.igd, 0), `${fmtPct(pct(c.igdRanap, c.igd))} dirawat inap`],
              ["Pasien dirawat inap", fmt(c.ri, 0), `${fmt(c.paps, 0)} PAPS · ${fmt(c.dirujuk, 0)} dirujuk`],
              ["Meninggal (rawat inap)", fmt(c.mati, 0), `IGD: ${fmt(c.igdDoa, 0)} DOA · ${fmt(c.igdDoe, 0)} DOE`],
              ["Pasien bedah (IBP)", fmt(c.ibp, 0), "elektif + emergensi"],
            ].map(([l, v, sub]) => (
              <div key={l} className="ok-tile">
                <b>{v}</b>
                <span>{l}</span>
                <span className="muted-sm">{sub}</span>
              </div>
            ))}
          </div>

          <h4 className="pf-sub">Penjamin pasien rawat jalan</h4>
          <div className="rm-stack" role="img" aria-label="Komposisi penjamin rawat jalan">
            {PENJAMIN.filter(([k]) => c.penjamin[k] > 0).map(([k, l, col]) => (
              <span key={k} style={{ width: `${(c.penjamin[k] / pjTotal) * 100}%`, background: col }} title={`${l}: ${fmt(c.penjamin[k], 0)}`} />
            ))}
          </div>
          <div className="rm-legend">
            {PENJAMIN.filter(([k]) => c.penjamin[k] > 0).map(([k, l, col]) => (
              <span key={k}><i style={{ background: col }} />{l} {fmtPct(pct(c.penjamin[k], pjTotal))}</span>
            ))}
          </div>

          <div className="rm-cols">
            <div>
              <h4 className="pf-sub">10 penyakit terbanyak — rawat jalan</h4>
              <TopTable items={c.topRj} />
            </div>
            <div>
              <h4 className="pf-sub">10 penyakit terbanyak — rawat inap</h4>
              <TopTable items={c.topRi} />
            </div>
          </div>

          <div className="rm-cols">
            <div>
              <h4 className="pf-sub">Kunjungan per poliklinik (10 terbanyak)</h4>
              <Bars items={c.poli} />
            </div>
            <div>
              <h4 className="pf-sub">Pasien per ruang rawat inap</h4>
              <Bars items={c.ruang} max={20} />
            </div>
          </div>

          <div className="rm-cols">
            <div>
              <h4 className="pf-sub">Pasien dirawat inap per spesialis (10 terbanyak)</h4>
              <Bars items={c.spesialisRi} />
            </div>
            <div>
              <h4 className="pf-sub">Operasi IBP per sub-spesialis</h4>
              <Bars items={c.opSub} max={15} />
              <p className="muted-sm" style={{ marginTop: 6 }}>
                Per jenis: {c.opJenis.filter((x) => x.jumlah > 0).map((x) => `${x.nama} ${fmt(x.jumlah, 0)}`).join(" · ") || "—"}
              </p>
            </div>
          </div>

          {single && (
            <p className="muted-sm" style={{ marginTop: 8 }}>
              Dilaporkan RM: PODR {fmt(single.podr, 2)}% · MMR {fmt(single.mmr, 2)} · IMR {fmt(single.imr, 2)}
              {single.nmr != null ? ` · NMR ${fmt(single.nmr, 2)}` : ""} (satuan IMR/NMR berbeda antara laporan 2025 [‰] dan 2026 [jumlah kasus]).
            </p>
          )}
          <div className="rm-meta">
            Sumber:{" "}
            {reports.map((r) => `${monthLabel(r.month)} — ${r.sourceFile || "?"}`).join("; ")}
            {c.pmks > 0 && ` · Pasien PMKS/PPDS (di luar kunjungan RJ): ${fmt(c.pmks, 0)}`}
          </div>
        </>
      )}
    </section>
  );
}
