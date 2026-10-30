import { loadLogoDataUrl } from "@/lib/reportPdf";
import {
  formatDayKey,
  formatMinutes,
  formatWeekRange,
  weekStartKey,
  todayKey,
} from "@/lib/logdate";

const TEAL = [14, 116, 121];
const GRAY = [107, 114, 128];

function slug(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// Status logbook seorang anggota tim pada satu minggu (rekap bawahan).
export function memberStatusLabel(m) {
  if (m.approval) return "Disetujui";
  if (m.revision === "OPEN") return "Dikembalikan";
  if (m.revision === "FIXED") return "Sudah diperbaiki";
  return m.entries ? "Belum disetujui" : "Belum mengisi";
}

function categorySummary(entries) {
  const map = new Map();
  for (const e of entries) {
    const c = map.get(e.category) || { category: e.category, entries: 0, minutes: 0 };
    c.entries++;
    c.minutes += e.minutes;
    map.set(e.category, c);
  }
  return [...map.values()].sort((a, b) => b.minutes - a.minutes);
}

// Komentar pada kegiatan, ditampilkan di bawah uraian.
function commentLine(c) {
  return `> ${c.author?.name || "-"}: ${c.body}`;
}

function weeksInRange(from, to) {
  const weeks = [];
  for (let w = weekStartKey(from); w <= to; ) {
    weeks.push(w);
    const d = new Date(`${w}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 7);
    w = d.toISOString().slice(0, 10);
  }
  return weeks;
}

// Kop laporan; mengembalikan posisi y berikutnya.
function drawHeader(doc, { hospital, logoDataUrl, title, lines }) {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, 12, 16, 16);
    } catch {
      /* abaikan bila logo gagal */
    }
  }
  const tx = logoDataUrl ? margin + 21 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(hospital.fullName || hospital.name, tx, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(title, tx, 23);
  doc.text(`Dicetak: ${formatDayKey(todayKey(), false)}`, tx, 28);
  doc.setDrawColor(210);
  doc.line(margin, 32, pageW - margin, 32);

  let y = 39;
  doc.setFontSize(10);
  for (const [label, value] of lines) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(`: ${value}`, margin + 24, y);
    y += 5.5;
  }
  return y + 3;
}

function drawFooter(doc, hospital) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(hospital.name, 14, pageH - 8);
    doc.text(`Halaman ${i} dari ${pages}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

function sectionTitle(doc, text, y) {
  const pageH = doc.internal.pageSize.getHeight();
  if (y > pageH - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(20);
  doc.text(text, 14, y);
  return y + 3;
}

// Dokumen PDF logbook seorang personel (dapat diuji terpisah).
export async function buildLogbookDoc({
  owner,
  from,
  to,
  entries,
  approvals,
  comments = [],
  revisions = [],
  approverNames,
  hospital,
  logoDataUrl,
}) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const total = entries.reduce((s, e) => s + e.minutes, 0);
  let y = drawHeader(doc, {
    hospital,
    logoDataUrl,
    title: "Logbook Kegiatan Personel",
    lines: [
      ["Nama", owner.name],
      ["Jabatan", owner.position?.name || "-"],
      ["Bidang", owner.position?.bidang || "-"],
      ["Periode", `${formatDayKey(from, false)} s.d. ${formatDayKey(to, false)}`],
    ],
  });

  // Ringkasan per kategori
  y = sectionTitle(doc, "Ringkasan", y);
  autoTable(doc, {
    startY: y + 1,
    head: [["Kategori", "Jumlah kegiatan", "Total waktu"]],
    body: [
      ...categorySummary(entries).map((c) => [c.category, c.entries, formatMinutes(c.minutes)]),
      [{ content: "TOTAL", styles: { fontStyle: "bold" } }, { content: entries.length, styles: { fontStyle: "bold" } }, { content: formatMinutes(total), styles: { fontStyle: "bold" } }],
    ],
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Status persetujuan per minggu
  const apprBy = new Map(approvals.map((a) => [a.weekStart, a]));
  const revBy = new Map(revisions.map((r) => [r.weekStart, r]));
  y = sectionTitle(doc, "Status Persetujuan Atasan", y);
  autoTable(doc, {
    startY: y + 1,
    head: [["Minggu", "Status", "Disetujui oleh", "Tanggal"]],
    body: weeksInRange(from, to).map((w) => {
      const a = apprBy.get(w);
      return [
        formatWeekRange(w),
        a
          ? "Disetujui"
          : revBy.get(w)
            ? revBy.get(w).resolvedAt
              ? "Sudah diperbaiki, menunggu persetujuan"
              : "Dikembalikan untuk perbaikan"
            : "Belum disetujui",
        a?.approvedBy?.name || "-",
        a ? formatDayKey(String(a.approvedAt).slice(0, 10), false) : "-",
      ];
    }),
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 8;

  // Rincian kegiatan
  y = sectionTitle(doc, "Rincian Kegiatan", y);
  if (entries.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text("Tidak ada kegiatan pada periode ini.", margin, y + 5);
    y += 12;
  } else {
    autoTable(doc, {
      startY: y + 1,
      head: [["Tanggal", "Jam", "Kategori", "Uraian kegiatan", "Hasil / output", "Bukti"]],
      body: entries.map((e) => [
        formatDayKey(e.date),
        `${e.startTime}-${e.endTime}\n(${formatMinutes(e.minutes)})`,
        e.category,
        [
          e.description,
          e.task ? `[Tugas: ${e.task.title}]` : null,
          ...comments.filter((c) => c.entryId === e.id).map(commentLine),
        ]
          .filter(Boolean)
          .join("\n"),
        e.output || "-",
        e.evidenceUrl || "-",
      ]),
      theme: "striped",
      headStyles: { fillColor: TEAL, fontSize: 8 },
      bodyStyles: { fontSize: 8, valign: "top" },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 20 },
        2: { cellWidth: 24 },
        5: { cellWidth: 30, textColor: [14, 116, 144] },
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Catatan / komentar per minggu (masukan atasan & balasan)
  const weekNotes = comments.filter((c) => c.entryId == null);
  if (weekNotes.length > 0) {
    y = sectionTitle(doc, "Catatan Atasan & Tanggapan", y - 2);
    autoTable(doc, {
      startY: y + 1,
      head: [["Minggu", "Dari", "Catatan"]],
      body: weekNotes.map((c) => [
        formatWeekRange(c.weekStart),
        `${c.author?.name || "-"}\n${formatDayKey(String(c.createdAt).slice(0, 10), false)}`,
        c.kind === "REVISION" ? `[Dikembalikan untuk perbaikan] ${c.body}` : c.body,
      ]),
      theme: "striped",
      headStyles: { fillColor: TEAL, fontSize: 8 },
      bodyStyles: { fontSize: 8, valign: "top" },
      columnStyles: { 0: { cellWidth: 34 }, 1: { cellWidth: 40 } },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Blok tanda tangan
  if (y > pageH - 45) {
    doc.addPage();
    y = 25;
  }
  const colW = (pageW - margin * 2) / 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text("Yang membuat,", margin, y);
  doc.text("Mengetahui, Atasan langsung", margin + colW, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.text(owner.name, margin, y);
  doc.text(approverNames?.[0] || "(....................................)", margin + colW, y);

  drawFooter(doc, hospital);
  return doc;
}

export async function generateLogbookPdf(data) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = await buildLogbookDoc({ ...data, logoDataUrl });
  doc.save(`logbook-${slug(data.owner.name)}-${data.from}_${data.to}.pdf`);
}

// ---------- CSV ----------
function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function downloadCsv(filename, rows) {
  const text = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  // BOM agar Excel membaca karakter Indonesia dengan benar.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadLogbookCsv({ owner, from, to, entries, comments = [] }) {
  downloadCsv(`logbook-${slug(owner.name)}-${from}_${to}.csv`, [
    [`Logbook Kegiatan - ${owner.name}`],
    [`Jabatan: ${owner.position?.name || "-"}`, `Bidang: ${owner.position?.bidang || "-"}`],
    [`Periode: ${from} s.d. ${to}`],
    [],
    ["Tanggal", "Jam mulai", "Jam selesai", "Durasi (menit)", "Kategori", "Uraian", "Hasil/output", "Tugas terkait", "Link bukti", "Komentar"],
    ...entries.map((e) => [
      e.date,
      e.startTime,
      e.endTime,
      e.minutes,
      e.category,
      e.description,
      e.output || "",
      e.task?.title || "",
      e.evidenceUrl || "",
      comments
        .filter((c) => c.entryId === e.id)
        .map((c) => `${c.author?.name || "-"}: ${c.body}`)
        .join(" | "),
    ]),
    ...(comments.some((c) => c.entryId == null)
      ? [
          [],
          ["Catatan per minggu"],
          ["Minggu", "Dari", "Tanggal", "Catatan"],
          ...comments
            .filter((c) => c.entryId == null)
            .map((c) => [
              c.weekStart,
              c.author?.name || "-",
              String(c.createdAt).slice(0, 10),
              c.kind === "REVISION" ? `[Dikembalikan untuk perbaikan] ${c.body}` : c.body,
            ]),
        ]
      : []),
  ]);
}

// ---------- Rekap tim (bawahan) ----------
export function downloadTeamCsv({ weekStart, weekEnd, members, byCategory }) {
  downloadCsv(`rekap-logbook-${weekStart}.csv`, [
    [`Rekap Logbook Bawahan - minggu ${weekStart} s.d. ${weekEnd}`],
    [],
    ["Nama", "Jabatan", "Bidang", "Jumlah kegiatan", "Total menit", "Status", "Disetujui oleh"],
    ...members.map((m) => [
      m.name,
      m.position?.name || "",
      m.position?.bidang || "",
      m.entries,
      m.minutes,
      memberStatusLabel(m),
      m.approval?.approvedBy || "",
    ]),
    [],
    ["Kategori", "Jumlah kegiatan", "Total menit"],
    ...byCategory.map((c) => [c.category, c.entries, c.minutes]),
  ]);
}

export async function buildTeamDoc({ weekStart, weekEnd, members, byCategory, hospital, logoDataUrl }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 14;

  const filled = members.filter((m) => m.entries > 0).length;
  const approved = members.filter((m) => m.approval).length;
  let y = drawHeader(doc, {
    hospital,
    logoDataUrl,
    title: "Rekap Logbook Bawahan",
    lines: [
      ["Periode", formatWeekRange(weekStart)],
      ["Personel", `${members.length} orang · ${filled} mengisi · ${approved} disetujui`],
    ],
  });

  y = sectionTitle(doc, "Rekap per Personel", y);
  autoTable(doc, {
    startY: y + 1,
    head: [["Nama", "Jabatan", "Kegiatan", "Total waktu", "Status"]],
    body: members.map((m) => [
      m.name,
      m.position?.name || "-",
      m.entries,
      formatMinutes(m.minutes),
      m.approval ? `Disetujui (${m.approval.approvedBy || "-"})` : memberStatusLabel(m),
    ]),
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: { 2: { halign: "center" }, 3: { halign: "right" } },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 8;

  y = sectionTitle(doc, "Total Waktu per Kategori", y);
  autoTable(doc, {
    startY: y + 1,
    head: [["Kategori", "Jumlah kegiatan", "Total waktu"]],
    body: byCategory.length
      ? byCategory.map((c) => [c.category, c.entries, formatMinutes(c.minutes)])
      : [["Belum ada kegiatan", "-", "-"]],
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: "center" }, 2: { halign: "right" } },
    margin: { left: margin, right: margin },
  });

  drawFooter(doc, hospital);
  return doc;
}

export async function generateTeamPdf(data) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = await buildTeamDoc({ ...data, logoDataUrl });
  doc.save(`rekap-logbook-${data.weekStart}.pdf`);
}
