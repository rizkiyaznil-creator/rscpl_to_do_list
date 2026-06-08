import {
  STATUS_LABELS,
  PRIORITY_LABELS,
  STATUS_ORDER,
} from "@/lib/constants";
import { formatDate } from "@/lib/format";

const TEAL = [14, 116, 121];
const GRAY = [107, 114, 128];
const LIGHT = [236, 240, 241];

// Ambil logo dari /public sebagai data URL untuk disisipkan ke PDF (browser).
async function loadLogoDataUrl() {
  try {
    const res = await fetch("/logo-rsusu.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

// Bangun dokumen PDF laporan (dapat diuji terpisah). Mengembalikan instance jsPDF.
export async function buildReportDoc({ stats, tasks, hospital, logoDataUrl }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const today = formatDate(new Date());

  // ---------- Kop laporan ----------
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
  doc.text("Laporan & Statistik Tugas Personel", tx, 23);
  doc.text(`Dicetak: ${today}`, tx, 28);
  doc.setDrawColor(210);
  doc.line(margin, 32, pageW - margin, 32);

  let y = 40;
  const heading = (text, size = 12) => {
    if (y > pageH - 28) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(size);
    doc.setTextColor(20);
    doc.text(text, margin, y);
    y += 2;
  };

  // ---------- Ringkasan ----------
  heading("Ringkasan");
  autoTable(doc, {
    startY: y + 2,
    head: [["Total", "Belum", "Sedang", "Selesai", "Lewat tenggat", "% Penyelesaian"]],
    body: [[
      stats.totals.total,
      stats.totals.todo,
      stats.totals.inProgress,
      stats.totals.done,
      stats.totals.overdue,
      `${stats.totals.completionRate}%`,
    ]],
    theme: "grid",
    headStyles: { fillColor: TEAL, halign: "center", fontSize: 9 },
    bodyStyles: { halign: "center", fontSize: 12, fontStyle: "bold" },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 9;

  // ---------- Per Departemen ----------
  heading("Per Departemen");
  autoTable(doc, {
    startY: y + 2,
    head: [["Departemen", "Total", "Selesai", "Sedang", "Belum", "Lewat", "% Selesai"]],
    body: stats.byDepartment.map((d) => [
      d.department,
      d.total,
      d.done,
      d.inProgress,
      d.todo,
      d.overdue,
      `${pct(d.done, d.total)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      1: { halign: "center" },
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 9;

  // ---------- Data per personel ----------
  const tasksByOwner = new Map();
  for (const t of tasks) {
    if (!tasksByOwner.has(t.ownerId)) tasksByOwner.set(t.ownerId, []);
    tasksByOwner.get(t.ownerId).push(t);
  }
  const avgProgress = (id) => {
    const arr = tasksByOwner.get(id) || [];
    if (!arr.length) return 0;
    return Math.round(arr.reduce((s, t) => s + (t.progress || 0), 0) / arr.length);
  };
  const persons = stats.byPerson.filter((p) => p.total > 0);

  // ---------- Beban Kerja Personel ----------
  heading("Beban Kerja Personel");
  autoTable(doc, {
    startY: y + 2,
    head: [["Personel", "Departemen", "Total", "Selesai", "Sedang", "Belum", "Lewat", "Progress"]],
    body: persons.map((p) => [
      p.name,
      p.department,
      p.total,
      p.done,
      p.inProgress,
      p.todo,
      p.overdue,
      `${avgProgress(p.id)}%`,
    ]),
    theme: "striped",
    headStyles: { fillColor: TEAL, fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5 },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "center" },
      4: { halign: "center" },
      5: { halign: "center" },
      6: { halign: "center" },
      7: { halign: "right" },
    },
    margin: { left: margin, right: margin },
  });
  y = doc.lastAutoTable.finalY + 11;

  // ---------- Rincian Tugas per Personel ----------
  heading("Rincian Tugas per Personel", 13);
  y += 3;

  if (persons.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY);
    doc.text("Belum ada tugas.", margin, y);
  }

  const statusRank = (s) => {
    const i = STATUS_ORDER.indexOf(s);
    return i === -1 ? 99 : i;
  };

  for (const p of persons) {
    const arr = (tasksByOwner.get(p.id) || []).slice().sort((a, b) => {
      const r = statusRank(a.status) - statusRank(b.status);
      if (r) return r;
      const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return da - db;
    });
    if (!arr.length) continue;

    // Judul personel (jaga agar tidak tersangkut di dasar halaman).
    if (y > pageH - 32) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...TEAL);
    doc.text(p.name, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...GRAY);
    doc.text(
      `${p.department} · ${arr.length} tugas · rata-rata progress ${avgProgress(p.id)}%`,
      margin,
      y + 4.5,
    );
    y += 7.5;

    autoTable(doc, {
      startY: y,
      head: [["Judul Tugas", "Prioritas", "Status", "Tenggat", "Progress"]],
      body: arr.map((t) => [
        t.title,
        PRIORITY_LABELS[t.priority] || t.priority,
        STATUS_LABELS[t.status] || t.status,
        t.dueDate ? formatDate(t.dueDate) : "-",
        `${t.progress ?? 0}%`,
      ]),
      theme: "striped",
      headStyles: { fillColor: TEAL, fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      alternateRowStyles: { fillColor: LIGHT },
      columnStyles: {
        1: { halign: "center", cellWidth: 24 },
        2: { halign: "center", cellWidth: 30 },
        3: { halign: "center", cellWidth: 26 },
        4: { halign: "right", cellWidth: 20 },
      },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 7;
  }

  // ---------- Footer: nomor halaman ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(hospital.name, margin, pageH - 8);
    doc.text(`Halaman ${i} dari ${pages}`, pageW - margin, pageH - 8, {
      align: "right",
    });
  }

  return doc;
}

// Buat & unduh PDF laporan (dipanggil dari browser).
export async function generateReportPdf({ stats, tasks, hospital }) {
  const logoDataUrl = await loadLogoDataUrl();
  const doc = await buildReportDoc({ stats, tasks, hospital, logoDataUrl });
  const fname = `laporan-${(hospital.name || "rs")
    .toLowerCase()
    .replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fname);
}
