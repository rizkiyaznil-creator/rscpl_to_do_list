"use client";

import { useState, useEffect } from "react";
import { durationMinutes, formatMinutes, todayKey } from "@/lib/logdate";
import { STATUS } from "@/lib/constants";

const OTHER = "__other";

// Form tambah/ubah kegiatan logbook.
export default function LogEntryModal({ entry, defaultDate, ownerId, categories, onClose, onSaved }) {
  const names = categories.map((c) => c.name);
  const initialCat = entry ? (names.includes(entry.category) ? entry.category : OTHER) : names[0] || OTHER;
  const [form, setForm] = useState({
    date: entry?.date || defaultDate || todayKey(),
    startTime: entry?.startTime || "08:00",
    endTime: entry?.endTime || "09:00",
    category: initialCat,
    customCategory: entry && initialCat === OTHER ? entry.category : "",
    description: entry?.description || "",
    output: entry?.output || "",
    evidenceUrl: entry?.evidenceUrl || "",
    taskId: entry?.task?.id ?? "",
  });
  const [tasks, setTasks] = useState([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Daftar tugas milik pemilik logbook untuk ditautkan (opsional).
  useEffect(() => {
    fetch(`/api/tasks?ownerId=${ownerId}`)
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks || []))
      .catch(() => {});
  }, [ownerId]);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const minutes = durationMinutes(form.startTime, form.endTime);
  const overnight = minutes !== null && form.endTime <= form.startTime;

  async function submit(e) {
    e.preventDefault();
    setError("");
    const category = form.category === OTHER ? form.customCategory.trim() : form.category;
    if (!category) {
      setError("Tulis nama kategori untuk pilihan \"Lainnya\".");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(entry ? `/api/logbook/${entry.id}` : "/api/logbook", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          category,
          description: form.description,
          output: form.output,
          evidenceUrl: form.evidenceUrl,
          taskId: form.taskId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Tidak dapat terhubung ke server.");
      setSaving(false);
    }
  }

  // Tugas aktif ditampilkan lebih dulu; tugas yang sedang tertaut tetap muncul.
  const taskOptions = tasks
    .filter((t) => t.status !== STATUS.DONE || t.id === form.taskId)
    .concat(tasks.filter((t) => t.status === STATUS.DONE && t.id !== form.taskId));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{entry ? "Ubah Kegiatan" : "Tambah Kegiatan"}</h3>
        <form onSubmit={submit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="field-row">
            <div className="field">
              <label>Tanggal *</label>
              <input
                type="date"
                value={form.date}
                max={todayKey()}
                onChange={(e) => set("date", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Jam mulai *</label>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label>Jam selesai *</label>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
                required
              />
            </div>
          </div>
          <p className="muted-sm" style={{ marginTop: -6 }}>
            Durasi: <b>{minutes === null ? "—" : formatMinutes(minutes)}</b>
            {overnight && " (melewati tengah malam)"}
          </p>

          <div className="field">
            <label>Kategori *</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}>
              {names.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
              <option value={OTHER}>Lainnya (tulis sendiri)</option>
            </select>
          </div>
          {form.category === OTHER && (
            <div className="field">
              <label>Nama kategori *</label>
              <input
                value={form.customCategory}
                onChange={(e) => set("customCategory", e.target.value)}
                placeholder="mis. Supervisi, Dinas luar, Visite"
                maxLength={60}
                autoFocus
              />
            </div>
          )}

          <div className="field">
            <label>Uraian kegiatan *</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="mis. Rapat koordinasi tarif dengan bagian keuangan"
              rows={3}
              required
            />
          </div>
          <div className="field">
            <label>Hasil / output</label>
            <textarea
              value={form.output}
              onChange={(e) => set("output", e.target.value)}
              placeholder="mis. Draf tarif baru disepakati"
              rows={2}
            />
          </div>
          <div className="field">
            <label>Link bukti (Google Drive / cloud)</label>
            <input
              type="url"
              value={form.evidenceUrl}
              onChange={(e) => set("evidenceUrl", e.target.value)}
              placeholder="https://drive.google.com/..."
            />
            <small className="muted-sm">
              Pastikan akses link sudah dibagikan agar atasan bisa membukanya.
            </small>
          </div>
          <div className="field">
            <label>Terkait tugas (opsional)</label>
            <select value={form.taskId} onChange={(e) => set("taskId", e.target.value)}>
              <option value="">— Tidak terkait tugas —</option>
              {taskOptions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                  {t.status === STATUS.DONE ? " (selesai)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose} disabled={saving}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
