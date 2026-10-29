"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";
import { hospital } from "@/lib/hospitalProfile";
import NotificationBell from "@/components/NotificationBell";

// Menu utama. `match` = awalan path yang menandai menu sebagai aktif.
const NAV = [
  { href: "/dashboard", label: "Dashboard", match: ["/dashboard"] },
  { href: "/tugas", label: "Tugas", match: ["/tugas"] },
  { href: "/logbook", label: "Logbook", match: ["/logbook"] },
  { href: "/laporan", label: "Laporan", match: ["/laporan"] },
  { href: "/admin", label: "Kelola Personel", match: ["/admin"], admin: true },
  { href: "/", label: "Profil RS", match: [] },
];

export default function TopBar({ user }) {
  const router = useRouter();
  const pathname = usePathname() || "";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/dashboard" className="brand" style={{ color: "inherit" }}>
          <img className="mark" src="/logo-rsusu.png" alt="Logo RS CPL USU" />
          <span>
            {hospital.name}
            <small>Manajemen Tugas Personel</small>
          </span>
        </Link>
        <div className="spacer" />
        {/* Di HP, menu ini pindah ke baris kedua & bisa digeser ke samping. */}
        <nav className="topnav">
          {NAV.filter((n) => !n.admin || user?.role === ROLES.ADMIN).map((n) => {
            const active = n.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`btn btn-sm ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <NotificationBell />
        <Link href="/akun" className="userchip" title="Akun saya">
          <span className="avatar">{initials(user?.name)}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <span
              className={`badge ${
                user?.role === ROLES.ADMIN ? "badge-role" : "badge-staff"
              }`}
            >
              {ROLE_LABELS[user?.role] || "Personel"}
            </span>
          </div>
        </Link>
        <button className="btn btn-sm" onClick={logout}>
          Keluar
        </button>
      </div>
    </header>
  );
}
