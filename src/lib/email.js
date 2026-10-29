import nodemailer from "nodemailer";
import { PRIORITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

// Konfigurasi pengirim email (SMTP). Diisi lewat env:
//   SMTP_USER      = alamat email pengirim (mis. notifikasi.rscplusu@gmail.com)
//   SMTP_PASS      = "App Password" 16 huruf (Gmail) / password SMTP
//   SMTP_FROM_NAME = nama pengirim yang tampil (opsional)
//   SMTP_HOST, SMTP_PORT = opsional; bila kosong memakai Gmail. Isi bila RS
//                          memakai server email sendiri.
//   APP_URL        = alamat aplikasi untuk tautan di email (opsional)
function getTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null; // belum dikonfigurasi -> email dilewati
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
}

const appUrl = () => (process.env.APP_URL || "https://rscpl-to-do-list.vercel.app").replace(/\/$/, "");

// Kirim email. Best-effort: TIDAK melempar error agar operasi utama (mis.
// pembuatan tugas) tidak gagal hanya karena email gagal terkirim.
// important = true -> ditandai "High Importance" (Outlook) / prioritas tinggi.
export async function sendEmail({ to, cc, subject, html, text, important = true }) {
  const toList = [].concat(to || []).filter(Boolean);
  const ccList = [].concat(cc || []).filter((e) => e && !toList.includes(e));
  if (!toList.length) return false;
  const transport = getTransport();
  if (!transport) {
    console.warn("SMTP belum dikonfigurasi (SMTP_USER/SMTP_PASS) — email dilewati.");
    return false;
  }
  const fromName = process.env.SMTP_FROM_NAME || "RS CPL USU";
  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to: toList,
      cc: ccList.length ? ccList : undefined,
      subject,
      text: text || undefined,
      html,
      // nodemailer: menambahkan header X-Priority: 1, X-MSMail-Priority: High, Importance: High
      priority: important ? "high" : "normal",
    });
    return true;
  } catch (e) {
    console.error("Gagal mengirim email:", e?.message || e);
    return false;
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Judul & subjek per jenis pengingat.
const KINDS = {
  new: { heading: "📋 Tugas Baru untuk Anda", subject: "Tugas baru" },
  h3: { heading: "📅 Pengingat: Tenggat 3 Hari Lagi (H-3)", subject: "Tenggat 3 hari lagi" },
  h1: { heading: "📅 Pengingat: Tenggat Besok (H-1)", subject: "Tenggat besok" },
  today: { heading: "⏰ Pengingat: Tenggat Hari Ini", subject: "Tenggat hari ini" },
  overdue: { heading: "⚠️ Tugas Lewat Tenggat", subject: "Lewat tenggat" },
};

// Bangun subject + isi email pengingat tugas.
//   kind: "new" | "h3" | "h1" | "today" | "overdue"
//   opts: { ownerName, daysOverdue, cced } — untuk email lewat tenggat
export function taskReminderEmail(task, kind, opts = {}) {
  const k = KINDS[kind] || KINDS.today;
  const prio = PRIORITY_LABELS[task.priority] || task.priority;
  const due = task.dueDate ? formatDate(task.dueDate) : "—";
  const link = `${appUrl()}/tugas?task=${task.id}`;
  const subject = `[PENTING] ${k.subject}: ${task.title}`;
  const late =
    kind === "overdue" && opts.daysOverdue
      ? `Tugas ini telah melewati tenggat <b>${opts.daysOverdue} hari</b> dan belum selesai.`
      : "";
  const rows = [
    opts.ownerName ? ["Penanggung jawab", escapeHtml(opts.ownerName)] : null,
    ["Prioritas", prio],
    ["Tenggat", due],
    task.progress !== undefined && task.progress !== null ? ["Progress", `${task.progress}%`] : null,
  ].filter(Boolean);

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <div style="background:${kind === "overdue" ? "#b91c1c" : "#0e7490"};color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:13px;opacity:.9">RS CPL USU · Manajemen Tugas Personel</div>
      <h2 style="margin:4px 0 0;font-size:18px">${k.heading}</h2>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:18px 20px">
      <h3 style="margin:0 0 10px;font-size:16px">${escapeHtml(task.title)}</h3>
      ${late ? `<p style="margin:0 0 12px;color:#b91c1c">${late}</p>` : ""}
      ${task.description ? `<p style="margin:0 0 14px;color:#4b5563">${escapeHtml(task.description)}</p>` : ""}
      <table style="font-size:14px;border-collapse:collapse">
        ${rows.map(([a, b]) => `<tr><td style="padding:4px 14px 4px 0;color:#6b7280">${a}</td><td style="font-weight:600">${b}</td></tr>`).join("")}
      </table>
      <p style="margin:18px 0 0">
        <a href="${link}" style="display:inline-block;background:#0e7490;color:#fff;text-decoration:none;padding:9px 16px;border-radius:8px;font-weight:600">Buka tugas</a>
      </p>
      ${opts.cced ? `<p style="margin:14px 0 0;font-size:12px;color:#6b7280">Salinan email ini dikirim ke atasan langsung.</p>` : ""}
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">
        Email otomatis dari aplikasi Manajemen Tugas RS CPL USU. Mohon tidak dibalas.
      </p>
    </div>
  </div>`;

  const text =
    `${k.heading}\n\n${task.title}\n` +
    (kind === "overdue" && opts.daysOverdue ? `Telah melewati tenggat ${opts.daysOverdue} hari dan belum selesai.\n` : "") +
    (task.description ? `${task.description}\n` : "") +
    `\n${rows.map(([a, b]) => `${a}: ${String(b).replace(/<[^>]+>/g, "")}`).join("\n")}\n\nBuka tugas: ${link}\n\n— Manajemen Tugas RS CPL USU`;

  return { subject, html, text };
}
