import { PERF_GROUPS, PERF_FREQ_LABELS, PERF_KIND_LABELS } from "@/lib/constants";
import { parseNumberLoose } from "@/lib/perfServer";

// Normalisasi & validasi isian parameter (dipakai POST & PATCH).
export function readParamBody(body, { partial = false } = {}) {
  const data = {};
  const err = (e) => ({ error: e });
  if (!partial || "name" in body) {
    const name = (body?.name || "").trim();
    if (!name) return err("Nama parameter wajib diisi.");
    data.name = name;
  }
  if (!partial || "group" in body) {
    if (!PERF_GROUPS[body?.group]) return err("Kelompok tidak valid.");
    data.group = body.group;
  }
  if (!partial || "freq" in body) {
    if (!PERF_FREQ_LABELS[body?.freq]) return err("Frekuensi tidak valid.");
    data.freq = body.freq;
  }
  if (!partial || "kind" in body) {
    if (!PERF_KIND_LABELS[body?.kind]) return err("Jenis parameter tidak valid.");
    data.kind = body.kind;
  }
  if ("unit" in body) data.unit = (body.unit || "").trim() || null;
  if ("source" in body) data.source = (body.source || "").trim() || null;
  if ("targetOp" in body || "target" in body) {
    const t = parseNumberLoose(body.target);
    if (t === null) {
      data.target = null;
      data.targetOp = null;
    } else {
      if (Number.isNaN(t)) return err("Target harus berupa angka.");
      if (body.targetOp !== "GTE" && body.targetOp !== "LTE") return err("Pilih arah target (≥ atau ≤).");
      data.target = t;
      data.targetOp = body.targetOp;
    }
  }
  if ("active" in body) data.active = Boolean(body.active);
  if ("order" in body && Number.isFinite(Number(body.order))) data.order = Number(body.order);
  return { data };
}
