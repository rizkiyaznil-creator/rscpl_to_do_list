"use client";

import { useState } from "react";
import {
  KS_TIPE_LABEL,
  KS_JENIS_MITRA_LABEL,
  KS_HASIL,
  KS_HASIL_LABEL,
  KS_REKOMENDASI,
  KS_REKOMENDASI_LABEL,
  evalSchedule,
  mitraNames,
  isMultipihak,
  multipihakLabel,
  fmtTgl,
  daysBetween,
} from "@/lib/kerjasama";
import { formatDateTime } from "@/lib/format";

async function post(url, body, method = "POST") {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Gagal menyimpan.");
  return d;
}

// Ringkasan perbedaan usulan vs data sekarang.
function usulanDiff(k) {
  const u = k.usulan?.data || {};
  const label = { tipe: "Tipe", bidang: "Bidang", mulai: "Mulai", berakhir: "Berakhir", evalBulan: "Periode evaluasi", isi: "Isi", nomorDokumen: "Nomor dokumen", linkDokumen: "Link dokumen", unitPelaksana: "Unit pelaksana", keterangan: "Keterangan" };
  const out = [];
  for (const [f, l] of Object.entries(label)) {
    const a = k[f] ?? null;
    const b = u[f] ?? null;
    if (String(a ?? "") !== String(b ?? "")) out.push([l, f === "tipe" ? KS_TIPE_LABEL[a] : a, f === "tipe" ? KS_TIPE_LABEL[b] : b]);
  }
  const ma = k.mitra.map((m) => `${m.nama} (${m.pimpinan || "-"}; ${m.kontakPic || "-"})`).join(" | ");
  const mb = (k.usulan?.mitra || []).map((m) => `${m.nama} (${m.pimpinan || "-"}; ${m.kontakPic || "-"})`).join(" | ");
  if (ma !== mb) out.push(["Mitra", ma, mb]);
  return out;
}

export default function KsDetail({ k, access, me, today, onClose, onChanged, onEdit, onExtend, onOpen }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [returning, setReturning] = useState(null); // { url, target? }
  const [note, setNote] = useState("");
  const [evalForm, setEvalForm] = useState(null); // { ke, due, ...input }
  const [showAll, setShowAll] = useState(false);

  const run = async (fn, ok) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ type: "success", text: ok });
      setReturning(null);
      setNote("");
      setEvalForm(null);
      await onChanged();
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    } finally {
      setBusy(false);
    }
  };

  const mine = k.createdById === me;
  const canEdit = access.verify || (access.input && (k.status === "FINAL" || mine));
  const canDelete = access.verify || (access.input && mine && k.status !== "FINAL");
  const canExtend = access.input && k.status === "FINAL" && k.berakhir && !k.perpanjangan;
  const sched = evalSchedule(k, today);
  const required = sched.filter((s) => s.wajib);
  const skipped = sched.length - required.length;
  const nextIdx = required.findIndex((s) => s.due >= today);
  const visible = showAll ? required : required.filter((s, i) => s.evaluasi || s.due <= today || i === nextIdx);
  const ended = k.berakhir && k.berakhir < today;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide ks-detail" onClick={(e) => e.stopPropagation()}>
        <div className="ks-detail-head">
          <div>
            <h3 style={{ marginBottom: 4 }}>{mitraNames(k)}</h3>
            <span className="chip">{KS_TIPE_LABEL[k.tipe]}</span>{" "}
            <span className={`chip ${k.st.tone === "warn" ? "chip-warn" : k.st.tone === "danger" ? "chip-danger" : k.st.tone === "muted" ? "chip-muted" : ""}`}>{k.st.label}</span>{" "}
            {isMultipihak(k) && <span className="chip chip-muted">{multipihakLabel(k)}</span>}{" "}
            {k.sumber === "IMPOR" && <span className="chip chip-muted">impor Excel{k.jenisAsal ? ` · jenis: ${k.jenisAsal}` : ""}</span>}
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        {msg && <div className={`alert alert-${msg.type}`}>{msg.text}</div>}
        {k.alarms.map((a) => (
          <div key={a.kind} className={`ks-alarm ${a.level}`} style={{ marginBottom: 4 }}>
            {a.level === "danger" ? "⚠" : a.level === "warn" ? "⏰" : "ℹ"} {a.label}
          </div>
        ))}
        {k.missing.length > 0 && k.status === "FINAL" && <div className="ks-alarm info">Perlu dilengkapi: {k.missing.join(", ")}</div>}

        {/* ── Verifikasi data ── */}
        {k.status !== "FINAL" && (
          <div className="ks-verif">
            <b>{k.status === "MENUNGGU" ? "🔎 Menunggu verifikasi" : "↩ Dikembalikan untuk perbaikan"}</b>
            <div className="muted-sm">
              Diinput {k.createdBy?.name || "—"} · {formatDateTime(k.createdAt)}
            </div>
            {k.catatanVerif && <div className="ks-note">Alasan: {k.catatanVerif}</div>}
            {access.verify && (
              <div className="row-actions">
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => post(`/api/kerjasama/${k.id}/verifikasi`, { target: "data", aksi: "setujui" }), "Data diverifikasi — kini final.")}>
                  ✓ Verifikasi
                </button>
                {k.status === "MENUNGGU" && (
                  <button className="btn btn-sm" disabled={busy} onClick={() => setReturning({ url: `/api/kerjasama/${k.id}/verifikasi`, target: "data" })}>
                    ↩ Kembalikan
                  </button>
                )}
              </div>
            )}
            {!access.verify && mine && k.status === "DIKEMBALIKAN" && (
              <div className="row-actions">
                <button className="btn btn-sm btn-primary" onClick={onEdit}>✎ Perbaiki & kirim ulang</button>
              </div>
            )}
          </div>
        )}

        {/* ── Usulan perubahan ── */}
        {k.usulan && (
          <div className="ks-verif">
            <b>✎ Usulan perubahan dari {k.usulanBy?.name || "—"}</b> <span className="muted-sm">· {formatDateTime(k.usulanAt)}</span>
            <table className="t2" style={{ marginTop: 6 }}>
              <thead><tr><th>Data</th><th>Sekarang</th><th>Usulan</th></tr></thead>
              <tbody>
                {usulanDiff(k).map(([l, a, b]) => (
                  <tr key={l}><td>{l}</td><td className="muted-sm">{a || "—"}</td><td><b>{b || "—"}</b></td></tr>
                ))}
              </tbody>
            </table>
            {access.verify && (
              <div className="row-actions">
                <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => post(`/api/kerjasama/${k.id}/verifikasi`, { target: "usulan", aksi: "setujui" }), "Usulan perubahan disetujui.")}>
                  ✓ Setujui perubahan
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={() => setReturning({ url: `/api/kerjasama/${k.id}/verifikasi`, target: "usulan" })}>
                  ↩ Kembalikan
                </button>
              </div>
            )}
          </div>
        )}

        {returning && (
          <div className="ks-verif">
            <label>Alasan dikembalikan *</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
            <div className="row-actions">
              <button
                className="btn btn-sm btn-danger"
                disabled={busy || !note.trim()}
                onClick={() => run(() => post(returning.url, { target: returning.target, aksi: "kembalikan", catatan: note }), "Dikembalikan ke penginput.")}
              >
                Kembalikan
              </button>
              <button className="btn btn-sm" onClick={() => setReturning(null)}>Batal</button>
            </div>
          </div>
        )}

        {/* ── Data kerjasama ── */}
        <div className="ks-info">
          <div><span>Bidang</span><b>{k.bidang || "—"}</b></div>
          <div>
            <span>Masa kerjasama</span>
            <b>{fmtTgl(k.mulai)} – {k.berakhir ? fmtTgl(k.berakhir) : "tanpa tanggal berakhir"}</b>
            {k.berakhir && !ended && <small> (sisa {daysBetween(today, k.berakhir)} hari)</small>}
          </div>
          <div><span>Evaluasi wajib</span><b>{k.evalBulan ? `Tiap ${k.evalBulan} bulan` : "belum diisi"}</b></div>
          <div><span>Nomor dokumen</span><b>{k.nomorDokumen || "—"}</b></div>
          <div>
            <span>Link dokumen</span>
            {k.linkDokumen ? <a href={k.linkDokumen} target="_blank" rel="noopener noreferrer">Buka dokumen ↗</a> : <b>—</b>}
          </div>
          {k.unitPelaksana && <div><span>Unit pelaksana</span><b>{k.unitPelaksana}</b></div>}
          <div className="wide"><span>Isi kerjasama ringkas</span><p>{k.isi || "—"}</p></div>
          {k.keterangan && <div className="wide"><span>Keterangan</span><p>{k.keterangan}</p></div>}
          {k.perpanjanganDari && (
            <div className="wide">
              <span>Perpanjangan dari</span>
              <button className="link-btn" onClick={() => onOpen(k.perpanjanganDari.id)}>kerjasama #{k.perpanjanganDari.id} ({k.perpanjanganDari.nomorDokumen || "tanpa nomor"})</button>
            </div>
          )}
          {k.perpanjangan && (
            <div className="wide">
              <span>Diperpanjang dengan</span>
              <button className="link-btn" onClick={() => onOpen(k.perpanjangan.id)}>
                kerjasama #{k.perpanjangan.id} ({fmtTgl(k.perpanjangan.mulai)} – {k.perpanjangan.berakhir ? fmtTgl(k.perpanjangan.berakhir) : "tanpa batas"})
                {k.perpanjangan.status !== "FINAL" ? " — menunggu verifikasi" : ""}
              </button>
            </div>
          )}
        </div>

        <h4 className="pf-sub">Mitra</h4>
        <div className="table-wrap">
          <table className="t2">
            <thead><tr><th>Nama</th><th>Jenis</th><th>Pimpinan</th><th>Kontak PIC</th></tr></thead>
            <tbody>
              {k.mitra.map((m) => (
                <tr key={m.id}>
                  <td><b>{m.nama}</b></td>
                  <td className="muted-sm">{KS_JENIS_MITRA_LABEL[m.jenis]}</td>
                  <td>{m.pimpinan || <i className="muted-sm">belum diisi</i>}</td>
                  <td>{m.kontakPic || <i className="muted-sm">belum diisi</i>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Evaluasi wajib ── */}
        <h4 className="pf-sub">Evaluasi wajib</h4>
        {!k.evalBulan ? (
          <p className="muted-sm">Periode evaluasi belum diisi — klik Ubah untuk melengkapi.</p>
        ) : k.status !== "FINAL" ? (
          <p className="muted-sm">Jadwal evaluasi aktif setelah data kerjasama diverifikasi.</p>
        ) : (
          <>
            {skipped > 0 && (
              <p className="muted-sm">
                {skipped} jadwal sebelum {fmtTgl(k.wajibEvalSejak)} (sebelum dicatat di aplikasi) tidak diwajibkan.
              </p>
            )}
            <div className="table-wrap">
              <table className="t2 ks-eval">
                <thead><tr><th>Ke</th><th>Jadwal</th><th>Hasil</th><th>Rekomendasi</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {visible.map((s) => {
                    const e = s.evaluasi;
                    const late = !e && s.due < today;
                    return (
                      <tr key={s.ke} className={late ? "late" : ""}>
                        <td>{s.ke}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {fmtTgl(s.due)}
                          {late && <div className="ks-alarm danger">terlambat {daysBetween(s.due, today)} hari</div>}
                        </td>
                        <td>
                          {e ? (
                            <>
                              <b>{KS_HASIL_LABEL[e.hasil]}</b>
                              <div className="muted-sm">{fmtTgl(e.tanggal)} · {e.catatan}</div>
                              <a href={e.link} target="_blank" rel="noopener noreferrer" className="muted-sm">dokumen ↗</a>
                            </>
                          ) : (
                            <span className="muted-sm">—</span>
                          )}
                        </td>
                        <td>{e ? KS_REKOMENDASI_LABEL[e.rekomendasi] : ""}</td>
                        <td className="muted-sm">
                          {e?.status === "FINAL" && `✓ ${e.verifiedBy?.name || ""}`}
                          {e?.status === "MENUNGGU" && `menunggu verifikasi (${e.createdBy?.name || ""})`}
                          {e?.status === "DIKEMBALIKAN" && <span className="ks-alarm danger">dikembalikan: {e.catatanVerif}</span>}
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          {access.verify && e?.status === "MENUNGGU" && (
                            <>
                              <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => run(() => post(`/api/kerjasama/evaluasi/${e.id}/verifikasi`, { aksi: "setujui" }), `Evaluasi ke-${s.ke} diverifikasi.`)}>✓</button>{" "}
                              <button className="btn btn-sm" disabled={busy} onClick={() => setReturning({ url: `/api/kerjasama/evaluasi/${e.id}/verifikasi` })}>↩</button>{" "}
                            </>
                          )}
                          {access.input && !ended && (!e || e.status !== "FINAL" || access.verify) && (s.due <= today || daysBetween(today, s.due) <= 30 || e) && (
                            <button
                              className="btn btn-sm"
                              onClick={() =>
                                setEvalForm({
                                  ke: s.ke,
                                  due: s.due,
                                  tanggal: e?.tanggal || today,
                                  hasil: e?.hasil || "SESUAI",
                                  rekomendasi: e?.rekomendasi || "LANJUT",
                                  catatan: e?.catatan || "",
                                  link: e?.link || "",
                                })
                              }
                            >
                              {e ? "Ubah" : "Input hasil"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {required.length > visible.length && (
              <button className="link-btn" onClick={() => setShowAll(true)}>
                Tampilkan semua {required.length} jadwal evaluasi
              </button>
            )}
          </>
        )}

        {evalForm && (
          <div className="ks-verif">
            <b>Hasil evaluasi ke-{evalForm.ke}</b> <span className="muted-sm">(jadwal {fmtTgl(evalForm.due)})</span>
            {!access.verify && <div className="muted-sm">Hasil akan diverifikasi Koordinator Kerja Sama.</div>}
            <div className="field-row">
              <div className="field">
                <label>Tanggal evaluasi *</label>
                <input type="date" value={evalForm.tanggal} onChange={(e) => setEvalForm({ ...evalForm, tanggal: e.target.value })} />
              </div>
              <div className="field">
                <label>Hasil *</label>
                <select value={evalForm.hasil} onChange={(e) => setEvalForm({ ...evalForm, hasil: e.target.value })}>
                  {KS_HASIL.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Rekomendasi *</label>
                <select value={evalForm.rekomendasi} onChange={(e) => setEvalForm({ ...evalForm, rekomendasi: e.target.value })}>
                  {KS_REKOMENDASI.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
            <div className="field">
              <label>Catatan / temuan *</label>
              <textarea rows={3} value={evalForm.catatan} onChange={(e) => setEvalForm({ ...evalForm, catatan: e.target.value })} />
            </div>
            <div className="field">
              <label>Link dokumen evaluasi (Google Drive) *</label>
              <input value={evalForm.link} onChange={(e) => setEvalForm({ ...evalForm, link: e.target.value })} placeholder="https://drive.google.com/..." />
            </div>
            <div className="row-actions">
              <button
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={() => run(() => post(`/api/kerjasama/${k.id}/evaluasi`, evalForm), access.verify ? "Hasil evaluasi disimpan (final)." : "Hasil evaluasi dikirim untuk verifikasi.")}
              >
                {busy ? "Menyimpan..." : access.verify ? "Simpan" : "Kirim untuk verifikasi"}
              </button>
              <button className="btn btn-sm" onClick={() => setEvalForm(null)}>Batal</button>
            </div>
          </div>
        )}

        <p className="muted-sm" style={{ marginTop: 10 }}>
          Diinput {k.createdBy?.name || "—"} · {formatDateTime(k.createdAt)}
          {k.verifiedBy && ` · diverifikasi ${k.verifiedBy.name} ${formatDateTime(k.verifiedAt)}`}
        </p>

        <div className="modal-actions">
          {canDelete && (
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Hapus kerjasama "${mitraNames(k)}"? Riwayat evaluasinya ikut terhapus.`)) {
                  run(async () => {
                    await post(`/api/kerjasama/${k.id}`, null, "DELETE");
                    onClose();
                  }, "Dihapus.");
                }
              }}
            >
              Hapus
            </button>
          )}
          <div className="spacer" />
          {canExtend && <button className="btn" onClick={onExtend}>↻ Perpanjang</button>}
          {canEdit && <button className="btn" onClick={onEdit}>✎ Ubah</button>}
          <button className="btn btn-primary" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
