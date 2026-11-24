// Ekspor daftar kerjasama yang sedang tampil (PDF & Excel), dikelompokkan per tipe.
import { loadLogoDataUrl } from "@/lib/reportPdf";
import { hospital } from "@/lib/hospitalProfile";
import { KS_TIPE, KS_JENIS_MITRA_LABEL, fmtTgl, daysBetween } from "@/lib/kerjasama";

const TEAL = [14, 116, 121];
const GRAY = [107, 114, 128];

function rowOf(k, i, today) {
  const sisa = k.berakhir ? daysBetween(today, k.berakhir) : null;
  return {
    no: i + 1,
    mitra: k.mitra.map((m) => m.nama).join("\n"),
    jenis: k.mitra.map((m) => KS_JENIS_MITRA_LABEL[m.jenis] || "").join("\n"),
    pimpinan: k.mitra.map((m) => m.pimpinan || "-").join("\n"),
    pic: k.mitra.map((m) => m.kontakPic || "-").join("\n"),
    bidang: k.bidang || "-",
    masa: `${fmtTgl(k.mulai)} – ${k.berakhir ? fmtTgl(k.berakhir) : "tanpa batas"}${sisa != null && sisa >= 0 ? ` (sisa ${sisa} hr)` : ""}`,
    evaluasi: k.evalBulan ? `Tiap ${k.evalBulan} bln${k.next ? `; ke-${k.next.ke}: ${fmtTgl(k.next.due)}` : ""}` : "belum diisi",
    isi: k.isi || "-",
    nomor: k.nomorDokumen || "-",
    link: k.linkDokumen || "",
    status: [k.st.label, ...k.alarms.filter((a) => a.level !== "info").map((a) => a.label)].join("; "),
  };
}

const groups = (items) => KS_TIPE.map(([key, label]) => [label, items.filter((k) => k.tipe === key)]).filter(([, l]) => l.length);
const fileBase = (today) => `kerjasama-${today}`;

export async function downloadKsPdf({ items, today, filterLabel, printedBy }) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  if (logo) {
    try {
      doc.addImage(logo, "PNG", margin, 9, 14, 14);
    } catch {
      /* abaikan */
    }
  }
  const tx = logo ? margin + 18 : margin;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text(hospital.fullName || hospital.name, tx, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...GRAY);
  doc.text(`Daftar Kerjasama · ${filterLabel} · ${items.length} kerjasama`, tx, 19.5);
  doc.text(`Dicetak ${fmtTgl(today)} oleh ${printedBy}`, tx, 24);
  doc.setDrawColor(210);
  doc.line(margin, 27, pageW - margin, 27);
  let y = 31;
  for (const [label, list] of groups(items)) {
    if (y > pageH - 30) {
      doc.addPage();
      y = 14;
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEAL);
    doc.text(`${label} (${list.length})`, margin, y);
    autoTable(doc, {
      startY: y + 2,
      head: [["No", "Mitra", "Pimpinan", "Bidang", "Masa kerjasama", "Evaluasi wajib", "Isi ringkas", "Nomor dokumen", "Status / alarm"]],
      body: list.map((k, i) => {
        const r = rowOf(k, i, today);
        return [r.no, r.mitra, r.pimpinan, r.bidang, r.masa, r.evaluasi, r.isi, r.nomor, r.status];
      }),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.4, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: TEAL, fontSize: 7.5 },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 40 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 30 }, 5: { cellWidth: 24 }, 6: { cellWidth: 48 }, 7: { cellWidth: 34 } },
      margin: { left: margin, right: margin },
    });
    y = doc.lastAutoTable.finalY + 8;
  }
  const n = doc.getNumberOfPages();
  for (let p = 1; p <= n; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(...GRAY);
    doc.text(`Halaman ${p} / ${n}`, pageW - margin, pageH - 5, { align: "right" });
  }
  doc.save(`${fileBase(today)}.pdf`);
}

export async function downloadKsXlsx({ items, today, filterLabel, printedBy }) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = hospital.name;
  const ws = wb.addWorksheet("Kerjasama", { pageSetup: { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [
    { width: 5 }, { width: 40 }, { width: 22 }, { width: 26 }, { width: 28 }, { width: 28 }, { width: 30 },
    { width: 24 }, { width: 50 }, { width: 36 }, { width: 36 }, { width: 40 },
  ];
  ws.addRow([hospital.fullName || hospital.name]).font = { bold: true, size: 14 };
  ws.addRow([`Daftar Kerjasama · ${filterLabel} · ${items.length} kerjasama`]).font = { color: { argb: "FF6B7280" } };
  ws.addRow([`Dicetak ${fmtTgl(today)} oleh ${printedBy}`]).font = { color: { argb: "FF6B7280" } };
  const HEAD = ["No", "Mitra", "Jenis mitra", "Pimpinan mitra", "Kontak PIC mitra", "Bidang", "Masa kerjasama", "Evaluasi wajib", "Isi ringkas", "Nomor dokumen", "Link dokumen", "Status / alarm"];
  for (const [label, list] of groups(items)) {
    ws.addRow([]);
    const g = ws.addRow([`${label} (${list.length})`]);
    g.font = { bold: true, size: 12, color: { argb: "FF0E7479" } };
    const h = ws.addRow(HEAD);
    h.eachCell((c) => {
      c.font = { bold: true, color: { argb: "FFFFFFFF" } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0E7479" } };
      c.alignment = { vertical: "middle", wrapText: true };
    });
    list.forEach((k, i) => {
      const r = rowOf(k, i, today);
      const x = ws.addRow([r.no, r.mitra, r.jenis, r.pimpinan, r.pic, r.bidang, r.masa, r.evaluasi, r.isi, r.nomor, r.link, r.status]);
      x.alignment = { vertical: "top", wrapText: true };
      if (r.link) x.getCell(11).value = { text: r.link, hyperlink: r.link };
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileBase(today)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
