"use client";

import { useState } from "react";
import { KS_TIPE, KS_JENIS_MITRA, KS_EVAL_BULAN, addDaysKey, mitraNames } from "@/lib/kerjasama";

const emptyMitra = () => ({ nama: "", jenis: "INSTITUSI", pimpinan: "", kontakPic: "" });

function initial(mode, item) {
  if (!item) {
    return {
      data: { tipe: "PENDIDIKAN", bidang: "", mulai: "", berakhir: "", tanpaBatas: false, evalBulan: "6", isi: "", nomorDokumen: "", linkDokumen: "", unitPelaksana: "", keterangan: "" },
      mitra: [emptyMitra()],
    };
  }
  const data = {
    tipe: item.tipe,
    bidang: item.bidang || "",
    mulai: item.mulai || "",
    berakhir: item.berakhir || "",
    tanpaBatas: !item.berakhir,
    evalBulan: item.evalBulan ? String(item.evalBulan) : "",
    isi: item.isi || "",
    nomorDokumen: item.nomorDokumen || "",
    linkDokumen: item.linkDokumen || "",
    unitPelaksana: item.unitPelaksana || "",
    keterangan: item.keterangan || "",
  };
  const mitra = item.mitra.map((m) => ({ nama: m.nama, jenis: m.jenis, pimpinan: m.pimpinan || "", kontakPic: m.kontakPic || "" }));
  if (mode === "perpanjang") {
    data.mulai = item.berakhir ? addDaysKey(item.berakhir, 1) : "";
    data.berakhir = "";
    data.tanpaBatas = false;
    data.nomorDokumen = "";
    data.linkDokumen = "";
    data.keterangan = "";
  }
  return { data, mitra };
}

export default function KsForm({ mode, item, access, onClose, onSaved }) {
  const [state, setState] = useState(() => initial(mode, item));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { data, mitra } = state;
  const set = (k, v) => setState((s) => ({ ...s, data: { ...s.data, [k]: v } }));
  const setM = (i, k, v) => setState((s) => ({ ...s, mitra: s.mitra.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  const isEdit = mode === "edit";
  const staf = !access.verify;
  const usulan = isEdit && staf && item?.status === "FINAL";

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      data: { ...data, evalBulan: data.evalBulan ? Number(data.evalBulan) : null, berakhir: data.tanpaBatas ? null : data.berakhir },
      mitra,
      ...(mode === "perpanjang" && { perpanjanganDariId: item.id }),
    };
    try {
      const res = await fetch(isEdit ? `/api/kerjasama/${item.id}` : "/api/kerjasama", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setError(d.error || "Gagal menyimpan.");
      else onSaved(d.item);
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "perpanjang" ? "Perpanjang Kerjasama" : isEdit ? "Ubah Kerjasama" : "Tambah Kerjasama";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {mode === "perpanjang" && (
          <p className="muted-sm">
            Perpanjangan dari: <b>{mitraNames(item)}</b>. Isi masa, nomor &amp; link dokumen yang baru. Setelah final, kerjasama
            lama ditandai &quot;Diperpanjang&quot; dan alarm masa akhirnya berhenti.
          </p>
        )}
        {staf && (
          <div className="alert alert-warn">
            {usulan
              ? "Perubahan Anda disimpan sebagai USULAN. Data lama tetap tampil sampai disetujui Koordinator Kerja Sama."
              : "Data yang Anda input akan diverifikasi Koordinator Kerja Sama sebelum tampil final."}
          </div>
        )}
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}

          <div className="field-row">
            <div className="field">
              <label>Tipe kerjasama *</label>
              <select value={data.tipe} onChange={(e) => set("tipe", e.target.value)}>
                {KS_TIPE.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Bidang kerjasama *</label>
              <input value={data.bidang} onChange={(e) => set("bidang", e.target.value)} placeholder="mis. Pendidikan klinik / rujukan laboratorium" />
            </div>
          </div>

          <div className="ks-mitra-form">
            <div className="ks-mitra-head">
              <b>Mitra kerjasama *</b>
              <span className="muted-sm"> — tambahkan lebih dari satu untuk kerjasama tripartit/multipihak</span>
            </div>
            {mitra.map((m, i) => (
              <div key={i} className="ks-mitra-item">
                <div className="field-row">
                  <div className="field" style={{ flex: 2 }}>
                    <label>Nama institusi / badan usaha / badan lainnya *</label>
                    <input value={m.nama} onChange={(e) => setM(i, "nama", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Jenis mitra</label>
                    <select value={m.jenis} onChange={(e) => setM(i, "jenis", e.target.value)}>
                      {KS_JENIS_MITRA.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="field-row">
                  <div className="field">
                    <label>Nama pimpinan mitra *</label>
                    <input value={m.pimpinan} onChange={(e) => setM(i, "pimpinan", e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Kontak PIC mitra (nama &amp; no. HP/email) *</label>
                    <input value={m.kontakPic} onChange={(e) => setM(i, "kontakPic", e.target.value)} placeholder="mis. Yanette — 0812xxxx" />
                  </div>
                </div>
                {mitra.length > 1 && (
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => setState((s) => ({ ...s, mitra: s.mitra.filter((_, j) => j !== i) }))}>
                    ✕ Hapus mitra ini
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="btn btn-sm" onClick={() => setState((s) => ({ ...s, mitra: [...s.mitra, emptyMitra()] }))}>
              + Tambah mitra
            </button>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Tanggal mulai *</label>
              <input type="date" value={data.mulai} onChange={(e) => set("mulai", e.target.value)} />
            </div>
            <div className="field">
              <label>Tanggal berakhir *</label>
              <input type="date" value={data.tanpaBatas ? "" : data.berakhir} disabled={data.tanpaBatas} onChange={(e) => set("berakhir", e.target.value)} />
              <label className="ks-check">
                <input type="checkbox" checked={data.tanpaBatas} onChange={(e) => set("tanpaBatas", e.target.checked)} /> tanpa tanggal berakhir
              </label>
            </div>
            <div className="field">
              <label>Evaluasi wajib *</label>
              <select value={data.evalBulan} onChange={(e) => set("evalBulan", e.target.value)}>
                <option value="">— pilih —</option>
                {KS_EVAL_BULAN.map((b) => (
                  <option key={b} value={b}>Tiap {b} bulan</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label>Nomor dokumen (PKS/MoU/MoA) *</label>
              <input value={data.nomorDokumen} onChange={(e) => set("nomorDokumen", e.target.value)} placeholder="nomor RS dan nomor mitra" />
            </div>
            <div className="field">
              <label>Link dokumen (Google Drive) *</label>
              <input value={data.linkDokumen} onChange={(e) => set("linkDokumen", e.target.value)} placeholder="https://drive.google.com/..." />
            </div>
          </div>

          <div className="field">
            <label>Isi kerjasama ringkas *</label>
            <textarea rows={3} value={data.isi} onChange={(e) => set("isi", e.target.value)} />
          </div>

          <div className="field-row">
            <div className="field">
              <label>Unit pelaksana di RS (opsional)</label>
              <input value={data.unitPelaksana} onChange={(e) => set("unitPelaksana", e.target.value)} />
            </div>
            <div className="field">
              <label>Keterangan (opsional)</label>
              <input value={data.keterangan} onChange={(e) => set("keterangan", e.target.value)} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Menyimpan..." : usulan ? "Kirim usulan" : staf ? "Kirim untuk verifikasi" : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
