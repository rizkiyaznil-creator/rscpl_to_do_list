import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { loadOrg, canOverride } from "@/lib/logbook";
import { toKey, weekStartKey } from "@/lib/logdate";
import { parseLogEntryInput, isWeekLocked } from "@/lib/logEntryInput";

// Siapa boleh mengubah/menghapus sebuah kegiatan:
//  - minggu BELUM disetujui -> hanya pemiliknya
//  - minggu SUDAH disetujui (terkunci) -> hanya Direktur / Wadir terkait
async function checkEditable(session, entry, extraWeekStart = null) {
  const weeks = [weekStartKey(toKey(entry.date))];
  if (extraWeekStart && extraWeekStart !== weeks[0]) weeks.push(extraWeekStart);
  let locked = false;
  for (const w of weeks) {
    if (await isWeekLocked(entry.userId, w)) locked = true;
  }
  if (!locked) {
    return entry.userId === session.id
      ? null
      : "Hanya pemilik logbook yang dapat mengubah kegiatan ini.";
  }
  const org = await loadOrg();
  return canOverride(org, session.id, entry.userId)
    ? null
    : "Logbook minggu ini sudah disetujui atasan dan terkunci. Hanya Direktur/Wadir terkait yang dapat mengubahnya.";
}

async function loadEntry(params) {
  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId)) return null;
  return prisma.logEntry.findUnique({ where: { id: entryId } });
}

// PATCH /api/logbook/:id -> ubah kegiatan.
export async function PATCH(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const entry = await loadEntry(params);
  if (!entry) {
    return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  const parsed = await parseLogEntryInput(body, entry.userId);
  if (parsed.error) return Response.json({ error: parsed.error }, { status: 400 });

  // Periksa minggu asal & minggu tujuan (bila tanggal dipindah).
  const denied = await checkEditable(session, entry, parsed.weekStart);
  if (denied) return Response.json({ error: denied }, { status: 403 });

  const updated = await prisma.logEntry.update({
    where: { id: entry.id },
    data: parsed.data,
    include: { task: { select: { id: true, title: true } } },
  });
  return Response.json({ entry: { ...updated, date: toKey(updated.date) } });
}

// DELETE /api/logbook/:id -> hapus kegiatan.
export async function DELETE(request, { params }) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Tidak terautentikasi." }, { status: 401 });
  }
  const entry = await loadEntry(params);
  if (!entry) {
    return Response.json({ error: "Kegiatan tidak ditemukan." }, { status: 404 });
  }
  const denied = await checkEditable(session, entry);
  if (denied) return Response.json({ error: denied }, { status: 403 });

  await prisma.logEntry.delete({ where: { id: entry.id } });
  return Response.json({ ok: true });
}
