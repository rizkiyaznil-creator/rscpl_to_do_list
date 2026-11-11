import { STATUS, STATUS_LABELS, PRIORITY_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { loadLogoDataUrl } from "@/lib/reportPdf";
import { todayKey, toKey, keyToDate } from "@/lib/logdate";

// Ekspor daftar tugas (PDF & Excel) dari Papan Tugas. Daftar yang diekspor
// adalah tugas yang sedang tampil (sudah tersaring & sebatas hak lihat user),
// dibagi dua: Belum selesai lalu Selesai.

const TEAL = [14, 116, 121];
const GRAY = [107, 114, 128];
const WIB_MS = 7 * 60 * 60 * 1000;

const isDone = (t) => t.status === STATUS.DONE;
const dayDiff = (a, b) => Math.round((keyToDate(a) - keyToDate(b)) / 86400000);
// Tanggal kalender WIB dari sebuah waktu (mis. completedAt).
const wibKey = (value) => new Date(new Date(value).getTime() + WIB_MS).toISOString().slice(0, 10);

// ---------- Periode (berdasarkan tenggat) ----------
export const PERIODS = {
  all: "Semua tenggat",
  thisMonth: "Tenggat bulan ini",
  lastMonth: "Tenggat bulan lalu",
  custom: "Rentang tanggal",
};

function monthBounds(key, shift) {
  const [y, m] = key.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + shift, 1));
  const last = new Date(Date.UTC(y, m + shift, 0));
  return [first.toISOString().slice(0, 10), last.toISOString().slice(0, 10)];
}

// -> { from, to } (kunci "YYYY-MM-DD") atau null untuk semua.
export function periodRange(kind, from, to) {
  const today = todayKey();
  if (kind === "thisMonth") {
    const [a, b] = monthBounds(today, 0);
    return { from: a, to: b };
  }
  if (kind === "lastMonth") {
    const [a, b] = monthBounds(today, -1);
    return { from: a, to: b };
  }
  if (kind === "custom" && from && to) return from <= to ? { from, to } : { from: to, to: from };
  return null;
}

export function inPeriod(task, range) {
  if (!range) return true;
  if (!task.dueDate) return false;
  const k = toKey(task.dueDate);
  return k >= range.from && k <= range.to;
}

export function periodLabel(kind, range) {
  if (!range) return PERIODS.all;
  return `Tenggat ${formatDate(range.from)} s.d. ${formatDate(range.to)}`;
}

// Keterangan singkat: sisa/lewat hari, atau tanggal selesai (+ terlambat).
export function taskRemark(t, today = todayKey()) {
  const due = t.dueDate ? toKey(t.dueDate) : null;
  if (isDone(t)) {
    if (!t.completedAt) return "Selesai";
    const done = wibKey(t.completedAt);
    const late = due ? dayDiff(done, due) : 0;
    return `Selesai ${formatDate(done)}${late > 0 ? ` (terlambat ${late} hari)` : ""}`;
  }
  if (!due) return "Tanpa tenggat";
  const d = dayDiff(due, today);
  if (d < 0) return `Lewat ${-d} hari`;
  if (d === 0) return "Tenggat hari ini";
  return `Sisa ${d} hari`;
}

export function summarize(tasks, today = todayKey()) {
  const s = { total: tasks.length, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  for (const t of tasks) {
    if (t.status === STATUS.TODO) s.todo++;
    else if (t.status === STATUS.IN_PROGRESS) s.inProgress++;
    else s.done++;
    if (!isDone(t) && t.dueDate && toKey(t.dueDate) < today) s.overdue++;
  }
  s.rate = s.total ? Math.round((s.done / s.total) * 100) : 0;
  return s;
}

// Urutan baku untuk laporan: belum selesai (tenggat terdekat dulu), lalu
// selesai (yang terbaru dulu).
export function splitForReport(tasks) {
  const due = (t) => (t.dueDate ? new Date(t.dueDate).getTime() : Infinity);
  const open = tasks.filter((t) => !isDone(t)).sort((a, b) => due(a) - due(b));
  const done = tasks
    .filter(isDone)
    .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));
  return { open, done };
}

function row(t, i, today) {
  return {
    no: i + 1,
    title: t.title,
    owner: t.owner?.name || "-",
    jabatan: t.owner?.position?.name || "-",
    bidang: t.owner?.position?.bidang || "-",
    creator: t.creator && t.creator.id !== t.ownerId ? t.creator.name : "-",
    priority: PRIORITY_LABELS[t.priority] || t.priority,
    status: STATUS_LABELS[t.status] || t.status,
    progress: t.progress ?? 0,
    due: t.dueDate ? toKey(t.dueDate) : null,
    remark: taskRemark(t, today),
    late: !isDone(t) && t.dueDate && toKey(t.dueDate) < today,
  };
}

const fileBase = (range) =>
  `laporan-tugas-${range ? `${range.from}_${range.to}` : todayKey()}`;

// ---------- PDF ----------
export async function buildTasksDoc({ tasks, filterLabel, periodText, printedBy, hospital, logoDataUrl }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const today = todayKey();

  // Kop
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", margin, 10, 15, 15);
    } catch {
      /* abaikan bila logo gagal */
    }
  }
  const tx = logoDataUrl ? margin + 19 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(hospital.fullName || hospital.name, tx, 15);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(`Laporan Tugas Personel · ${periodText}`, tx, 20.5);
  doc.text(`Filter: ${filterLabel} · Dicetak ${formatDate(today)} oleh ${printedBy}`, tx, 25.5);
  doc.setDrawColor(210);
  doc.line(margin, 29, pageW - margin, 29);

  // Ringkasan
  const s = summarize(tasks, today);
  autoTable(doc, {
    startY: 33,
    head: [["Total", "Belum dikerjakan", "Sedang dikerjakan", "Selesai", "Lewat tenggat", "% Selesai"]],
    body: [[s.total, s.todo, s.inProgress, s.done, s.overdue, `${s.rate}%`]],
    theme: "grid",
    headStyles: { fillColor: TEAL, halign: "center", fontSize: 8.5 },
    bodyStyles: { halign: "center", fontSize: 11, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });
  let y = doc.lastAutoTable.finalY + 7;

  const { open, done } = splitForReport(tasks);
  const head = [["No", "Tugas", "Penanggung jawab", "Bidang", "Ditugaskan oleh", "Prioritas", "Status", "Progress", "Tenggat", "Keterangan"]];
  const section = (title, list) => {
    if (y > pageH - 30) {
      doc.addPage();
      y = 16;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(20);
    doc.text(`${title} (${list.length})`, margin, y);
    if (list.length === 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GRAY);
      doc.text("Tidak ada tugas.", margin, y + 6);
      y += 13;
      return;
    }
    const rows = list.map((t, i) => row(t, i, today));
    autoTable(doc, {
      startY: y + 2.5,
      head,
      body: rows.map((r) => [
        r.no,
        r.title,
        `${r.owner}\n${r.jabatan}`,
        r.bidang,
        r.creator,
        r.priority,
        r.status,
        `${r.progress}%`,
        r.due ? formatDate(r.due) : "-",
        r.remark,
      ]),
      theme: "striped",
      headStyles: { fillColor: TEAL, fontSize: 8 },
      bodyStyles: { fontSize: 8, valign: "top" },
      columnStyles: {
        0: { cellWidth: 8, halign: "center" },
        1: { cellWidth: 55 },
        2: { cellWidth: 46 },
        3: { cellWidth: 30 },
        4: { cellWidth: 28 },
        5: { cellWidth: 16 },
        6: { cellWidth: 22 },
        7: { cellWidth: 18, halign: "right" },
        8: { cellWidth: 20 },
      },
      didParseCell: (d) => {
        if (d.section === "body" && d.column.index === 9 && rows[d.row.index]?.late) {
          d.cell.styles.textColor = [185, 28, 28];
          d.cell.styles.fontStyle = "bold";
        }
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 8;
  };
  section("Belum selesai", open);
  section("Selesai", done);

  // Tanda tangan
  if (y > pageH - 40) {
    doc.addPage();
    y = 20;
  }
  const colX = pageW - margin - 70;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(20);
  doc.text(`Medan, ${formatDate(today)}`, colX, y);
  doc.text("Mengetahui,", colX, y + 5);
  doc.text("(......................................................)", colX, y + 27);

  // Nomor halaman
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(`${hospital.name} · Laporan Tugas Personel`, margin, pageH - 7);
    doc.text(`Halaman ${i} dari ${pages}`, pageW - margin, pageH - 7, { align: "right" });
  }
  return doc;
}

export async function generateTasksPdf({ range, ...data }) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = await buildTasksDoc({ ...data, logoDataUrl });
  doc.save(`${fileBase(range)}.pdf`);
}

// ---------- Excel ----------
export async function buildTasksWorkbook({ tasks, filterLabel, periodText, printedBy, hospital }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = hospital.name;
  const ws = wb.addWorksheet("Laporan Tugas", {
    pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  const today = todayKey();
  ws.columns = [
    { key: "no", width: 5 },
    { key: "title", width: 42 },
    { key: "owner", width: 26 },
    { key: "jabatan", width: 32 },
    { key: "bidang", width: 26 },
    { key: "creator", width: 22 },
    { key: "priority", width: 10 },
    { key: "status", width: 18 },
    { key: "progress", width: 10 },
    { key: "due", width: 13 },
    { key: "remark", width: 30 },
  ];

  ws.addRow([hospital.fullName || hospital.name]).font = { bold: true, size: 14 };
  ws.addRow([`Laporan Tugas Personel · ${periodText}`]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([`Filter: ${filterLabel} · Dicetak ${formatDate(today)} oleh ${printedBy}`]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([]);
  const s = summarize(tasks, today);
  const sh = ws.addRow(["", "Total", "Belum dikerjakan", "Sedang dikerjakan", "Selesai", "Lewat tenggat", "% Selesai"]);
  sh.font = { bold: true };
  ws.addRow(["", s.total, s.todo, s.inProgress, s.done, s.overdue, s.rate / 100]).getCell(7).numFmt = "0%";

  const HEAD = ["No", "Tugas", "Penanggung jawab", "Jabatan", "Bidang", "Ditugaskan oleh", "Prioritas", "Status", "Progress", "Tenggat", "Keterangan"];
  const { open, done } = splitForReport(tasks);
  for (const [title, list] of [["BELUM SELESAI", open], ["SELESAI", done]]) {
    ws.addRow([]);
    const g = ws.addRow([`${title} (${list.length})`]);
    g.font = { bold: true, size: 12, color: { argb: "FF0E7479" } };
    const h = ws.addRow(HEAD);
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7479" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    list.forEach((t, i) => {
      const r = row(t, i, today);
      const x = ws.addRow([
        r.no, r.title, r.owner, r.jabatan, r.bidang, r.creator, r.priority, r.status,
        r.progress / 100, r.due ? keyToDate(r.due) : null, r.remark,
      ]);
      x.alignment = { vertical: "top", wrapText: true };
      x.getCell(9).numFmt = "0%";
      x.getCell(10).numFmt = "dd/mm/yyyy";
      if (r.late) x.getCell(11).font = { bold: true, color: { argb: "FFB91C1C" } };
    });
  }
  return wb;
}

export async function downloadTasksXlsx({ range, ...data }) {
  const wb = await buildTasksWorkbook(data);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(range)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
