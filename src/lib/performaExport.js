import { loadLogoDataUrl } from "@/lib/reportPdf";
import { hospital } from "@/lib/hospitalProfile";
import { formatDayKey, todayKey } from "@/lib/logdate";
import {
  BJ_DEFS,
  GRAN_LABELS,
  PERF_GROUP_ORDER,
  targetStatus,
  targetLabel,
  bjStatus,
  formatParam,
  formatBJ,
  STATUS_TEXT,
  BJ_STATUS_TEXT,
} from "@/lib/perfcalc";
import { PERF_GROUPS } from "@/lib/constants";

const TEAL = [14, 116, 121];
const GRAY = [107, 114, 128];

// Baris tabel ringkasan untuk ekspor (dipakai CSV & PDF).
function sections(data) {
  const cur = data.current;
  const prev = data.previousValues;
  const v = (vals, c) => vals[c]?.v ?? null;
  const out = [];
  for (const g of PERF_GROUP_ORDER) {
    const ps = data.params.filter((p) => p.group === g);
    if (!ps.length) continue;
    out.push({
      title: `${g}. ${PERF_GROUPS[g]}`,
      head: ["Parameter", "Nilai", "Sebelumnya", "Target", "Status"],
      rows: ps.map((p) => {
        const s = targetStatus(p, v(cur, p.code));
        return [p.name, formatParam(p, v(cur, p.code)), formatParam(p, v(prev, p.code)), targetLabel(p), s ? STATUS_TEXT[s] : "—"];
      }),
    });
    if (g === "B") {
      out.push({
        title: "Efisiensi rawat inap (Barber-Johnson)",
        head: ["Indikator", "Nilai", "Sebelumnya", "Ideal", "Status"],
        rows: BJ_DEFS.map((d) => {
          const s = bjStatus(d, v(cur, d.code));
          return [`${d.name} — ${d.desc}`, formatBJ(d.code, v(cur, d.code)), formatBJ(d.code, v(prev, d.code)), d.ideal, s ? BJ_STATUS_TEXT[s] : "—"];
        }),
      });
    }
  }
  return out;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function downloadPerformaCsv(data) {
  const cell = (x) => {
    const s = String(x ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    [`Performa RS - ${hospital.fullName}`],
    [`Periode: ${data.period.label} (${GRAN_LABELS[data.gran]})`, `Pembanding: ${data.previous.label}`],
    [],
  ];
  for (const s of sections(data)) {
    lines.push([s.title], s.head, ...s.rows, []);
  }
  const blob = new Blob(["﻿" + lines.map((r) => r.map(cell).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `performa-rs-${slug(data.period.label)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function generatePerformaPdf(data) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 12, 16, 16);
    } catch {
      /* abaikan */
    }
  }
  const tx = logo ? margin + 21 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(20);
  doc.text(hospital.fullName, tx, 17);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...GRAY);
  doc.text(`Laporan Performa RS · ${data.period.label} (${GRAN_LABELS[data.gran]})`, tx, 23);
  doc.text(`Pembanding: ${data.previous.label} · Dicetak: ${formatDayKey(todayKey(), false)}`, tx, 28);
  doc.setDrawColor(210);
  doc.line(margin, 32, pageW - margin, 32);

  let y = 40;
  for (const s of sections(data)) {
    if (y > pageH - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(20);
    doc.text(s.title, margin, y);
    autoTable(doc, {
      startY: y + 3,
      head: [s.head],
      body: s.rows,
      theme: "striped",
      headStyles: { fillColor: TEAL, fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 9;
  }

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text(hospital.name, margin, pageH - 8);
    doc.text(`Halaman ${i} dari ${pages}`, pageW - margin, pageH - 8, { align: "right" });
  }
  doc.save(`performa-rs-${slug(data.period.label)}.pdf`);
}
