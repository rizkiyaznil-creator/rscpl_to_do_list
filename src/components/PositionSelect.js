"use client";

// Hitung kedalaman tiap jabatan dalam pohon (untuk indentasi di dropdown).
export function withDepth(positions) {
  const byId = new Map(positions.map((p) => [p.id, p]));
  const depthOf = (p) => {
    let d = 0;
    let cur = p;
    const seen = new Set();
    while (cur?.parentId && byId.has(cur.parentId) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parentId);
      d++;
    }
    return d;
  };
  return positions.map((p) => ({ ...p, depth: depthOf(p) }));
}

// Dropdown jabatan sesuai SOTK. Jabatan struktural (1 orang) yang sudah
// dipegang orang lain ditandai & tidak bisa dipilih.
//   positions : hasil GET /api/positions (urut SOTK, berisi users)
//   userId    : id personel yang sedang diubah (agar jabatannya sendiri tetap bisa dipilih)
export default function PositionSelect({ id, positions, value, onChange, userId = null }) {
  const rows = withDepth(positions);
  return (
    <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Belum ditetapkan —</option>
      {rows.map((p) => {
        const holder = p.single ? (p.users || []).find((u) => u.id !== userId) : null;
        const indent = "   ".repeat(p.depth);
        return (
          <option key={p.id} value={p.id} disabled={Boolean(holder)}>
            {indent}
            {p.name}
            {holder ? ` (terisi: ${holder.name})` : ""}
          </option>
        );
      })}
    </select>
  );
}
