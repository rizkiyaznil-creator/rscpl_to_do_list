"use client";

import { useEffect, useRef } from "react";

// Polling hemat database (Neon ditagih per jam database menyala; database tidur
// setelah 5 menit tanpa query). Memanggil `load`:
//   - sekali saat dipasang,
//   - tiap `intervalMs` HANYA bila tab terlihat dan (bila `idleMs` diisi)
//     pengguna berinteraksi dalam `idleMs` terakhir,
//   - segera saat tab kembali terlihat / jendela kembali fokus, atau saat
//     pengguna berinteraksi lagi setelah diam — asalkan data terakhir sudah
//     lebih tua dari `minGapMs` (mencegah muat ganda beruntun).
// Tab tersembunyi / jendela di-minimize / layar yang ditinggal diam tidak
// mengirim permintaan sama sekali, sehingga database bisa tidur.
const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];

export function useActivePolling(load, { intervalMs = 60_000, idleMs = null, minGapMs = 30_000 } = {}) {
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    let lastLoad = 0;
    let lastActivity = Date.now();
    const visible = () => document.visibilityState === "visible";
    const idle = () => idleMs != null && Date.now() - lastActivity >= idleMs;
    const run = () => {
      lastLoad = Date.now();
      loadRef.current();
    };
    const runIfStale = () => {
      if (Date.now() - lastLoad >= minGapMs) run();
    };

    run();
    const timer = setInterval(() => {
      if (visible() && !idle()) run();
    }, intervalMs);

    const onActivity = () => {
      const wasIdle = idle();
      lastActivity = Date.now();
      if (wasIdle && visible()) runIfStale();
    };
    const onVisible = () => {
      if (!visible()) return;
      lastActivity = Date.now(); // kembali ke tab = tanda pengguna aktif
      runIfStale();
    };

    const opts = { passive: true, capture: true };
    if (idleMs != null) ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, opts));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      if (idleMs != null) ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, opts));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [intervalMs, idleMs, minGapMs]);
}
