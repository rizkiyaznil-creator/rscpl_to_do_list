"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import TopBar from "@/components/TopBar";
import KsForm from "@/components/kerjasama/KsForm";
import KsDetail from "@/components/kerjasama/KsDetail";
import KsImport from "@/components/kerjasama/KsImport";
import {
  KS_TIPE,
  ksStatus,
  ksAlarms,
  nextEval,
  missingFields,
  mitraNames,
  isMultipihak,
  multipihakLabel,
  fmtTgl,
  daysBetween,
} from "@/lib/kerjasama";

const FILTERS = [
  ["AKTIF", "Berjalan"],
  ["ALARM", "Ada alarm"],
  ["BERAKHIR", "Berakhir / diperpanjang"],
  ["SEMUA", "Semua"],
];
const UNIT_FILTERS = [
  ["MENUNGGU", "Menunggu verifikasi"],
  ["LENGKAPI", "Perlu dilengkapi"],
];

function enrich(k, today) {
  const st = ksStatus(k, today);
  const alarms = ksAlarms(k, today);
  return { ...k, st, alarms, next: nextEval(k, today), missing: missingFields(k) };
}

function match(k, filter) {
  const s = k.st.key;
  switch (filter) {
    case "AKTIF":
      return ["AKTIF", "AKAN_BERAKHIR", "MENUNGGU", "DIKEMBALIKAN"].includes(s);
    case "ALARM":
      return k.alarms.some((a) => a.level !== "info");
    case "BERAKHIR":
      return s === "BERAKHIR" || s === "DIPERPANJANG";
    case "MENUNGGU":
      return s === "MENUNGGU" || s === "DIKEMBALIKAN" || Boolean(k.usulan) || k.evaluasi.some((e) => e.status !== "FINAL");
    case "LENGKAPI":
      return k.status === "FINAL" && k.missing.length > 0 && !["BERAKHIR", "DIPERPANJANG"].includes(s);
    default:
      return true;
  }
}

export default function KerjasamaPage({ currentUser, initialId, initialFilter }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState(initialFilter || "AKTIF");
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null); // { mode: "create"|"edit"|"perpanjang", item? }
  const [detailId, setDetailId] = useState(initialId);
  const [showImport, setShowImport] = useState(false);
  const [exporting, setExporting] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/kerjasama", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Gagal memuat data.");
      else setData(d);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const today = data?.today;
  const access = data?.access || {};
  const items = useMemo(() => (data ? data.items.map((k) => enrich(k, today)) : []), [data, today]);
  const byId = useMemo(() => new Map(items.map((k) => [k.id, k])), [items]);
  const final = items.filter((k) => k.status === "FINAL");

  const query = q.trim().toLowerCase();
  const shown = items.filter(
    (k) =>
      match(k, filter) &&
      (!query ||
        [mitraNames(k), k.bidang, k.isi, k.nomorDokumen, ...k.mitra.map((m) => m.pimpinan || "")].join(" ").toLowerCase().includes(query)),
  );

  const counts = {
    aktif: final.filter((k) => ["AKTIF", "AKAN_BERAKHIR"].includes(k.st.key)),
    akanBerakhir: final.filter((k) => k.alarms.some((a) => a.kind.startsWith("END") || a.kind === "ENDED")),
    evaluasi: final.filter((k) => k.alarms.some((a) => a.kind.startsWith("EVAL_LATE") || a.kind.startsWith("EVAL_H14"))),
    menunggu: items.filter((k) => match(k, "MENUNGGU")),
    lengkapi: items.filter((k) => match(k, "LENGKAPI")),
  };

  async function doExport(kind) {
    setExporting(kind);
    try {
      const mod = await import("@/lib/ksExport");
      const label = [...FILTERS, ...UNIT_FILTERS].find((f) => f[0] === filter)?.[1] || "";
      await (kind === "pdf" ? mod.downloadKsPdf : mod.downloadKsXlsx)({ items: shown, today, filterLabel: label, printedBy: currentUser.name });
    } finally {
      setExporting("");
    }
  }

  const detail = detailId ? byId.get(detailId) : null;

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2 style={{ fontSize: 20 }}>🤝 Kerjasama</h2>
          <div className="spacer" />
          {access.input && (
            <button className="btn btn-sm btn-primary" onClick={() => setForm({ mode: "create" })}>
              + Tambah Kerjasama
            </button>
          )}
          {access.verify && (
            <button className="btn btn-sm" onClick={() => setShowImport(true)}>
              ⬆ Impor Excel
            </button>
          )}
          {data && (
            <>
              <button className="btn btn-sm" onClick={() => doExport("xlsx")} disabled={Boolean(exporting)}>
                {exporting === "xlsx" ? "Menyiapkan..." : "⬇ Excel"}
              </button>
              <button className="btn btn-sm" onClick={() => doExport("pdf")} disabled={Boolean(exporting)}>
                {exporting === "pdf" ? "Menyiapkan..." : "⬇ PDF"}
              </button>
            </>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {!data && !error && <p className="muted-sm">Memuat...</p>}

        {data && (
          <>
            <div className="ks-tiles">
              {KS_TIPE.map(([key, label]) => (
                <div key={key} className="ks-tile">
                  <b>{counts.aktif.filter((k) => k.tipe === key).length}</b>
                  <span>{label.replace("Kerjasama ", "")}</span>
                </div>
              ))}
            </div>
            <div className="ks-tiles alarms">
              <button className={`ks-tile ${counts.akanBerakhir.length ? "warn" : ""}`} onClick={() => setFilter("ALARM")}>
                <b>{counts.akanBerakhir.length}</b>
                <span>Akan/baru berakhir (≤ 90 hari)</span>
              </button>
              <button className={`ks-tile ${counts.evaluasi.length ? "danger" : ""}`} onClick={() => setFilter("ALARM")}>
                <b>{counts.evaluasi.length}</b>
                <span>Evaluasi jatuh tempo / terlambat</span>
              </button>
              {access.input && (
                <>
                  <button className={`ks-tile ${counts.menunggu.length ? "warn" : ""}`} onClick={() => setFilter("MENUNGGU")}>
                    <b>{counts.menunggu.length}</b>
                    <span>Menunggu verifikasi</span>
                  </button>
                  <button className={`ks-tile ${counts.lengkapi.length ? "warn" : ""}`} onClick={() => setFilter("LENGKAPI")}>
                    <b>{counts.lengkapi.length}</b>
                    <span>Perlu dilengkapi</span>
                  </button>
                </>
              )}
            </div>

            <div className="ks-filters">
              <div className="seg">
                {[...FILTERS, ...(access.input ? UNIT_FILTERS : [])].map(([key, label]) => (
                  <button key={key} className={filter === key ? "on" : ""} onClick={() => setFilter(key)}>
                    {label}
                  </button>
                ))}
              </div>
              <input
                className="ks-search"
                placeholder="Cari mitra, bidang, nomor dokumen, pimpinan..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            {KS_TIPE.map(([key, label]) => {
              const list = shown.filter((k) => k.tipe === key);
              if (!list.length) return null;
              return (
                <section key={key} className="ks-group">
                  <div className="ks-group-head">
                    <h3>{label}</h3>
                    <span className="count">{list.length}</span>
                  </div>
                  <div className="table-wrap">
                    <table className="t2 clickable ks-table">
                      <thead>
                        <tr>
                          <th>Mitra & pimpinan</th>
                          <th>Bidang</th>
                          <th>Masa kerjasama</th>
                          <th>Evaluasi wajib</th>
                          <th>Isi ringkas</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((k) => (
                          <KsRow key={k.id} k={k} today={today} onOpen={() => setDetailId(k.id)} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
            {shown.length === 0 && <p className="muted-sm" style={{ marginTop: 16 }}>Tidak ada kerjasama untuk filter ini.</p>}
          </>
        )}
      </main>

      {form && (
        <KsForm
          mode={form.mode}
          item={form.item}
          access={access}
          today={today}
          onClose={() => setForm(null)}
          onSaved={(item) => {
            setForm(null);
            load();
            if (item?.id) setDetailId(item.id);
          }}
        />
      )}
      {detail && !form && (
        <KsDetail
          k={detail}
          access={access}
          me={data.me}
          today={today}
          onClose={() => setDetailId(null)}
          onChanged={load}
          onEdit={() => setForm({ mode: "edit", item: detail })}
          onExtend={() => setForm({ mode: "perpanjang", item: detail })}
          onOpen={(id) => setDetailId(id)}
        />
      )}
      {showImport && (
        <KsImport
          today={today}
          onClose={() => setShowImport(false)}
          onDone={() => {
            setShowImport(false);
            load();
          }}
        />
      )}
    </>
  );
}

function KsRow({ k, today, onOpen }) {
  const sisa = k.berakhir ? daysBetween(today, k.berakhir) : null;
  const tone = { ok: "", warn: "chip-warn", danger: "chip-danger", muted: "chip-muted" }[k.st.tone];
  return (
    <tr onClick={onOpen}>
      <td className="ks-mitra">
        {k.mitra.map((m) => (
          <div key={m.id ?? m.nama}>
            <b>{m.nama}</b>
            <div className="muted-sm">{m.pimpinan || <i>pimpinan belum diisi</i>}</div>
          </div>
        ))}
        {isMultipihak(k) && <span className="chip chip-muted">{multipihakLabel(k)}</span>}
      </td>
      <td className="ks-col-text"><div className="clamp3">{k.bidang || "—"}</div></td>
      <td style={{ whiteSpace: "nowrap" }}>
        {fmtTgl(k.mulai)} – {k.berakhir ? fmtTgl(k.berakhir) : "tanpa batas"}
        {sisa != null && sisa >= 0 && <div className="muted-sm">sisa {sisa} hari</div>}
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        {k.evalBulan ? `Tiap ${k.evalBulan} bulan` : <span className="muted-sm">belum diisi</span>}
        {k.next && k.st.key !== "BERAKHIR" && (
          <div className="muted-sm">
            ke-{k.next.ke}: {fmtTgl(k.next.due)}
            {k.next.evaluasi?.status === "MENUNGGU" ? " (menunggu verifikasi)" : ""}
          </div>
        )}
      </td>
      <td className="ks-col-text">
        <div className="clamp3">{k.isi && k.isi !== k.bidang ? k.isi : <span className="muted-sm">{k.isi ? "(sama dengan bidang)" : "—"}</span>}</div>
      </td>
      <td className="ks-status">
        <span className={`chip ${tone}`}>{k.st.label}</span>
        {k.alarms
          .filter((a) => a.level !== "info")
          .map((a) => (
            <div key={a.kind} className={`ks-alarm ${a.level}`}>
              {a.level === "danger" ? "⚠" : "⏰"} {a.label}
            </div>
          ))}
        {k.usulan && <div className="ks-alarm warn">✎ usulan perubahan menunggu verifikasi</div>}
        {k.status === "FINAL" && k.missing.length > 0 && !["BERAKHIR", "DIPERPANJANG"].includes(k.st.key) && (
          <div className="ks-alarm info">perlu dilengkapi: {k.missing.join(", ")}</div>
        )}
      </td>
    </tr>
  );
}
