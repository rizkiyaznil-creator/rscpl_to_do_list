import nodemailer from "nodemailer";
import { PRIORITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";

// Konfigurasi pengirim email via Gmail (SMTP). Diisi lewat env:
//   SMTP_USER      = alamat Gmail pengirim (mis. notifikasi.rscplusu@gmail.com)
//   SMTP_PASS      = "App Password" 16 huruf dari akun Gmail tersebut
//   SMTP_FROM_NAME = nama pengirim yang tampil (opsional)
function getTransport() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!user || !pass) return null; // belum dikonfigurasi -> email dilewati
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
}

// Kirim email. Best-effort: TIDAK melempar error agar operasi utama (mis.
// pembuatan tugas) tidak gagal hanya karena email gagal terkirim.
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return false;
  const transport = getTransport();
  if (!transport) {
    console.warn("SMTP belum dikonfigurasi (SMTP_USER/SMTP_PASS) — email dilewati.");
    return false;
  }
  const fromName = process.env.SMTP_FROM_NAME || "RS CPL USU";
  try {
    await transport.sendMail({
      from: `"${fromName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text: text || undefined,
      html,
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

// Bangun subject + isi email pengingat tugas.
//   kind: "new" (tugas baru) | "h1" (H-1) | "today" (hari-H)
export function taskReminderEmail(task, kind) {
  const prio = PRIORITY_LABELS[task.priority] || task.priority;
  const due = task.dueDate ? formatDate(task.dueDate) : "—";

  const heading =
    kind === "new"
      ? "📋 Tugas Baru untuk Anda"
      : kind === "today"
        ? "⏰ Pengingat: Tenggat Hari Ini"
        : "📅 Pengingat: Tenggat Besok (H-1)";
  const subject =
    kind === "new"
      ? `[Tugas Baru] ${task.title}`
      : kind === "today"
        ? `[Tenggat Hari Ini] ${task.title}`
        : `[H-1] ${task.title}`;

  const html = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <div style="background:#0e7490;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:13px;opacity:.9">RS CPL USU · Manajemen Tugas Personel</div>
      <h2 style="margin:4px 0 0;font-size:18px">${heading}</h2>
    </div>
    <div style="border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;padding:18px 20px">
      <h3 style="margin:0 0 10px;font-size:16px">${escapeHtml(task.title)}</h3>
      ${task.description ? `<p style="margin:0 0 14px;color:#4b5563">${escapeHtml(task.description)}</p>` : ""}
      <table style="font-size:14px;border-collapse:collapse">
        <tr><td style="padding:4px 14px 4px 0;color:#6b7280">Prioritas</td><td style="font-weight:600">${prio}</td></tr>
        <tr><td style="padding:4px 14px 4px 0;color:#6b7280">Tenggat</td><td style="font-weight:600">${due}</td></tr>
      </table>
      <p style="margin:18px 0 0;font-size:12px;color:#9ca3af">
        Email otomatis dari aplikasi Manajemen Tugas RS CPL USU. Mohon tidak dibalas.
      </p>
    </div>
  </div>`;

  const text =
    `${heading}\n\n${task.title}\n` +
    (task.description ? `${task.description}\n` : "") +
    `\nPrioritas: ${prio}\nTenggat: ${due}\n\n— Manajemen Tugas RS CPL USU`;

  return { subject, html, text };
}
