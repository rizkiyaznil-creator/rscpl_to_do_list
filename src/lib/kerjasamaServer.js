import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { loadOrg, positionOf } from "@/lib/logbook";
import { notify } from "@/lib/notifications";
import { isHttpUrl, todayKey } from "@/lib/logdate";
import { KS_TIPE_LABEL, KS_JENIS_MITRA_LABEL, KS_EVAL_BULAN, KS_HASIL_LABEL, KS_REKOMENDASI_LABEL, mitraNames, toYmd, ksAlarms, ksStatus } from "@/lib/kerjasama";

// ── Hak akses menu Kerjasama ──
// Lihat   : Admin, Direktur, Wadir, Kepala SPI, unit Kerja Sama (Manajer, Koordinator, Staf).
// Input   : Admin & unit Kerja Sama. Input Staf perlu verifikasi.
// Verifikasi / input final: Admin, Manajer Kerja Sama dan Marketing, Koordinator Kerja Sama.
const SPI_BIDANG = "Satuan Pengawas Internal";
const isKsPos = (p) => p && /kerja\s*sama/i.test(p.name);

export function ksUnitRole(p) {
  if (!isKsPos(p)) return null;
  if (p.level === "MANAJER") return "MANAJER";
  if (p.level === "KOORDINATOR") return "KOORDINATOR";
  if (p.level === "STAF") return "STAF";
  return null;
}

export function ksAccess(org, session) {
  const admin = session.role === ROLES.ADMIN;
  const p = positionOf(org, session.id);
  const unit = ksUnitRole(p);
  const view =
    admin ||
    Boolean(unit) ||
    (p && (p.level === "DIREKTUR" || p.level === "WADIR" || (p.level === "KEPALA" && p.bidang === SPI_BIDANG)));
  return {
    view: Boolean(view),
    unit, // MANAJER | KOORDINATOR | STAF | null
    input: admin || Boolean(unit),
    verify: admin || unit === "MANAJER" || unit === "KOORDINATOR",
  };
}

export async function getKsAccess(session) {
  const org = await loadOrg();
  return { org, access: ksAccess(org, session) };
}

// Pemegang jabatan Manajer/Koordinator Kerja Sama (penerima notifikasi & email)
// dan Wadir di atasnya (CC email).
export function ksRecipients(org) {
  const active = (u) => u.status === USER_STATUS.ACTIVE;
  const verifiers = [];
  const wadir = new Set();
  for (const p of org.pos.values()) {
    const role = ksUnitRole(p);
    if (role !== "MANAJER" && role !== "KOORDINATOR") continue;
    for (const u of org.holders.get(p.id) || []) if (active(u)) verifiers.push(u.id);
    // Wadir pembina: naik dari jabatan ini sampai level WADIR.
    let cur = org.pos.get(p.parentId);
    while (cur && cur.level !== "WADIR") cur = org.pos.get(cur.parentId);
    if (cur) for (const u of org.holders.get(cur.id) || []) if (active(u)) wadir.add(u.id);
  }
  return { verifiers: [...new Set(verifiers)], wadir: [...wadir] };
}

// ── Validasi input ──
const str = (v, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const isKey = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// Mengembalikan { data, mitra } atau { error }. `lengkap` = semua field wajib harus terisi.
export function parseKsInput(body, { lengkap = true } = {}) {
  const d = body?.data || {};
  const tipe = String(d.tipe || "");
  if (!KS_TIPE_LABEL[tipe]) return { error: "Tipe kerjasama tidak valid." };
  const mulai = d.mulai;
  if (!isKey(mulai)) return { error: "Tanggal mulai wajib diisi." };
  const tanpaBatas = d.tanpaBatas === true;
  const berakhir = tanpaBatas ? null : d.berakhir;
  if (!tanpaBatas && !isKey(berakhir)) return { error: "Tanggal berakhir wajib diisi (atau centang 'tanpa tanggal berakhir')." };
  if (berakhir && berakhir < mulai) return { error: "Tanggal berakhir tidak boleh sebelum tanggal mulai." };
  const evalBulan = d.evalBulan == null || d.evalBulan === "" ? null : Number(d.evalBulan);
  if (evalBulan != null && !KS_EVAL_BULAN.includes(evalBulan)) return { error: "Periode evaluasi tidak valid." };
  const data = {
    tipe,
    bidang: str(d.bidang, 200),
    mulai,
    berakhir,
    evalBulan,
    isi: str(d.isi, 3000),
    nomorDokumen: str(d.nomorDokumen, 1000),
    linkDokumen: str(d.linkDokumen, 1000) || null,
    unitPelaksana: str(d.unitPelaksana, 200) || null,
    keterangan: str(d.keterangan, 2000) || null,
  };
  if (data.linkDokumen && !isHttpUrl(data.linkDokumen)) return { error: "Link dokumen harus berupa alamat http(s) (mis. tautan Google Drive)." };
  const mitraIn = Array.isArray(body?.mitra) ? body.mitra.slice(0, 20) : [];
  const mitra = mitraIn
    .map((m, i) => ({
      urutan: i,
      nama: str(m?.nama, 300),
      jenis: KS_JENIS_MITRA_LABEL[m?.jenis] ? m.jenis : "LAINNYA",
      pimpinan: str(m?.pimpinan, 200) || null,
      kontakPic: str(m?.kontakPic, 300) || null,
    }))
    .filter((m) => m.nama);
  if (!mitra.length) return { error: "Minimal satu mitra kerjasama wajib diisi." };
  if (lengkap) {
    const kurang = [];
    if (!data.bidang) kurang.push("bidang kerjasama");
    if (!data.isi) kurang.push("isi kerjasama ringkas");
    if (!data.nomorDokumen) kurang.push("nomor dokumen");
    if (!data.linkDokumen) kurang.push("link dokumen");
    if (!data.evalBulan) kurang.push("periode evaluasi wajib");
    if (mitra.some((m) => !m.pimpinan)) kurang.push("nama pimpinan setiap mitra");
    if (mitra.some((m) => !m.kontakPic)) kurang.push("kontak PIC setiap mitra");
    if (kurang.length) return { error: `Wajib diisi: ${kurang.join(", ")}.` };
  }
  return { data, mitra };
}

export const toDate = (key) => (key ? new Date(`${key}T00:00:00.000Z`) : null);
export const dbData = (data) => ({ ...data, mulai: toDate(data.mulai), berakhir: toDate(data.berakhir) });

export function parseEvalInput(body) {
  const tanggal = body?.tanggal;
  if (!isKey(tanggal)) return { error: "Tanggal evaluasi wajib diisi." };
  if (!KS_HASIL_LABEL[body?.hasil]) return { error: "Pilih hasil evaluasi." };
  if (!KS_REKOMENDASI_LABEL[body?.rekomendasi]) return { error: "Pilih rekomendasi." };
  const catatan = str(body?.catatan, 4000);
  if (!catatan) return { error: "Catatan/temuan evaluasi wajib diisi." };
  const link = str(body?.link, 1000);
  if (!isHttpUrl(link)) return { error: "Link dokumen evaluasi wajib berupa alamat http(s)." };
  return { tanggal, hasil: body.hasil, rekomendasi: body.rekomendasi, catatan, link };
}

// ── Data ──
const userSel = { select: { id: true, name: true } };
export const KS_INCLUDE = {
  mitra: { orderBy: { urutan: "asc" } },
  evaluasi: { orderBy: { ke: "asc" }, include: { createdBy: userSel, verifiedBy: userSel } },
  createdBy: userSel,
  verifiedBy: userSel,
  usulanBy: userSel,
  perpanjangan: { select: { id: true, status: true, mulai: true, berakhir: true } },
  perpanjanganDari: { select: { id: true, nomorDokumen: true } },
};

// Bentuk yang dikirim ke klien (tanggal -> "YYYY-MM-DD").
export function serializeKs(k) {
  return {
    ...k,
    mulai: toYmd(k.mulai),
    berakhir: toYmd(k.berakhir),
    wajibEvalSejak: toYmd(k.wajibEvalSejak),
    evaluasi: (k.evaluasi || []).map((e) => ({ ...e, jatuhTempo: toYmd(e.jatuhTempo), tanggal: toYmd(e.tanggal) })),
    perpanjangan: k.perpanjangan ? { ...k.perpanjangan, mulai: toYmd(k.perpanjangan.mulai), berakhir: toYmd(k.perpanjangan.berakhir) } : null,
  };
}

// Kerjasama yang boleh dilihat: unit Kerja Sama & Admin melihat semua (termasuk
// yang menunggu verifikasi); pimpinan hanya yang FINAL, tanpa usulan perubahan.
export async function loadKsList(access) {
  const rows = await prisma.kerjasama.findMany({
    where: access.input ? {} : { status: "FINAL" },
    include: KS_INCLUDE,
    orderBy: [{ mulai: "desc" }, { id: "desc" }],
  });
  return rows.map((k) => {
    const s = serializeKs(k);
    if (!access.input) {
      s.usulan = null;
      s.evaluasi = s.evaluasi.filter((e) => e.status === "FINAL");
    }
    return s;
  });
}

// ── Notifikasi lonceng ──
export async function notifyVerifiers(org, actorId, message, ksId) {
  const { verifiers } = ksRecipients(org);
  for (const uid of verifiers) await notify({ userId: uid, actorId, type: "KS_SUBMITTED", message, link: `/kerjasama?id=${ksId}` });
}
export async function notifyUser(userId, actorId, type, message, ksId) {
  await notify({ userId, actorId, type, message, link: `/kerjasama?id=${ksId}` });
}
export const ksTitle = (k) => mitraNames(k).slice(0, 120);

export { todayKey };

export const ksDenied = () =>
  Response.json({ error: "Menu Kerjasama hanya untuk Direktur, Wadir, Kepala SPI, Admin, dan unit Kerja Sama." }, { status: 403 });
export const ksUnauth = () => Response.json({ error: "Sesi login Anda telah berakhir. Silakan login ulang." }, { status: 401 });
export const ksBad = (error, status = 400) => Response.json({ error }, { status });

// Kerjasama FINAL versi ringan (untuk alarm lonceng, dashboard, email).
async function loadFinalLight() {
  const rows = await prisma.kerjasama.findMany({
    where: { status: "FINAL" },
    select: {
      id: true, tipe: true, status: true, mulai: true, berakhir: true, evalBulan: true, wajibEvalSejak: true,
      mitra: { select: { nama: true }, orderBy: { urutan: "asc" } },
      evaluasi: { select: { ke: true, status: true } },
      perpanjangan: { select: { status: true } },
    },
  });
  return rows.map((r) => ({ ...r, mulai: toYmd(r.mulai), berakhir: toYmd(r.berakhir), wajibEvalSejak: toYmd(r.wajibEvalSejak) }));
}

async function countPending() {
  const [a, b, c] = await Promise.all([
    prisma.kerjasama.count({ where: { status: "MENUNGGU" } }),
    prisma.kerjasama.count({ where: { NOT: { usulanById: null } } }),
    prisma.kerjasamaEvaluasi.count({ where: { status: "MENUNGGU" } }),
  ]);
  return a + b + c;
}

function alarmList(list, today) {
  const alarms = [];
  for (const k of list) {
    for (const a of ksAlarms(k, today)) {
      if (a.level === "info") continue;
      alarms.push({ id: k.id, mitra: mitraNames(k), label: a.label, level: a.level, kind: a.kind });
    }
  }
  return alarms.sort((a, b) => (a.level === b.level ? 0 : a.level === "danger" ? -1 : 1));
}

// Data lonceng untuk unit Kerja Sama: alarm aktif (warn/danger) + jumlah yang
// menunggu verifikasi (khusus verifikator).
export async function ksBellData(access) {
  if (!access.unit) return null;
  const today = todayKey();
  const alarms = alarmList(await loadFinalLight(), today).map(({ kind, ...a }) => a);
  return { alarms, pending: access.verify ? await countPending() : 0 };
}

// Ringkasan kartu Dashboard untuk yang berhak melihat menu Kerjasama.
export async function ksDashboard(session, org) {
  const access = org ? ksAccess(org, session) : (await getKsAccess(session)).access;
  if (!access.view) return null;
  const today = todayKey();
  const list = await loadFinalLight();
  const running = list.filter((k) => ["AKTIF", "AKAN_BERAKHIR"].includes(ksStatus(k, today).key));
  const alarms = alarmList(list, today);
  const ids = (re) => new Set(alarms.filter((a) => re.test(a.kind)).map((a) => a.id)).size;
  return {
    aktif: running.length,
    perTipe: Object.fromEntries(Object.keys(KS_TIPE_LABEL).map((t) => [t, running.filter((k) => k.tipe === t).length])),
    akanBerakhir: ids(/^END_|^ENDED/),
    evaluasi: ids(/^EVAL_(LATE|H14)/),
    pending: access.input ? await countPending() : null,
    alarms: alarms.slice(0, 5).map(({ kind, ...a }) => a),
  };
}

// Email harian alarm kerjasama (dipanggil /api/cron/kerjasama lewat cron harian):
// alarm BARU (belum pernah dikirim) -> satu email ke Manajer & Koordinator Kerja Sama,
// CC Wadir pembina. Alarm dicatat di KerjasamaReminder setelah email terkirim, jadi
// bila gagal akan dicoba lagi besok.
export async function sendKsDigest() {
  const { sendEmail, kerjasamaDigestEmail } = await import("@/lib/email");
  const today = todayKey();
  const org = await loadOrg();
  const { verifiers, wadir } = ksRecipients(org);
  const alarms = alarmList(await loadFinalLight(), today).filter((a) => /^(EVAL_LATE|EVAL_H14|END_H90|END_H30|ENDED)/.test(a.kind));
  if (!alarms.length) return { ok: true, baru: 0 };
  const sent = await prisma.kerjasamaReminder.findMany({
    where: { kerjasamaId: { in: [...new Set(alarms.map((a) => a.id))] } },
    select: { kerjasamaId: true, kind: true },
  });
  const done = new Set(sent.map((r) => `${r.kerjasamaId}|${r.kind}`));
  const fresh = alarms.filter((a) => !done.has(`${a.id}|${a.kind}`));
  if (!fresh.length) return { ok: true, baru: 0 };

  const users = await prisma.user.findMany({ where: { id: { in: [...verifiers, ...wadir] } }, select: { id: true, email: true } });
  const mail = (ids) => users.filter((u) => ids.includes(u.id) && u.email).map((u) => u.email);
  const to = mail(verifiers);
  const cc = mail(wadir);
  if (!to.length) return { ok: false, baru: fresh.length, alasan: "Manajer/Koordinator Kerja Sama belum memiliki email" };

  const pick = (re) => fresh.filter((a) => re.test(a.kind));
  const groups = [
    { title: "⚠ Evaluasi wajib terlambat", color: "#b91c1c", items: pick(/^EVAL_LATE/) },
    { title: "⚠ Kerjasama berakhir ≤ 30 hari / sudah berakhir", color: "#b91c1c", items: pick(/^(END_H30|ENDED)/) },
    { title: "⏰ Evaluasi wajib dalam 14 hari", color: "#b45309", items: pick(/^EVAL_H14/) },
    { title: "⏰ Kerjasama berakhir dalam 90 hari", color: "#b45309", items: pick(/^END_H90/) },
  ];
  const { subject, html, text } = kerjasamaDigestEmail(groups, { cced: cc.length > 0 });
  const ok = await sendEmail({ to, cc, subject, html, text });
  if (!ok) return { ok: false, baru: fresh.length, alasan: "email gagal terkirim / SMTP belum diatur" };
  await prisma.kerjasamaReminder.createMany({ data: fresh.map((a) => ({ kerjasamaId: a.id, kind: a.kind })), skipDuplicates: true });
  return { ok: true, baru: fresh.length, to: to.length, cc: cc.length };
}
