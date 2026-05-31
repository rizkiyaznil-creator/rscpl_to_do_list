"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ROLES, ROLE_LABELS } from "@/lib/constants";
import { initials } from "@/lib/format";

export default function TopBar({ user }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/dashboard" className="brand" style={{ color: "inherit" }}>
          <span className="mark">✚</span>
          <span>
            RSCPL To-Do
            <small>Manajemen Tugas Rumah Sakit</small>
          </span>
        </Link>
        <div className="spacer" />
        <Link href="/" className="btn btn-sm">
          Profil RS
        </Link>
        <Link href="/laporan" className="btn btn-sm">
          Laporan
        </Link>
        {user?.role === ROLES.ADMIN && (
          <Link href="/admin" className="btn btn-sm">
            Kelola Personel
          </Link>
        )}
        <div className="userchip">
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
        </div>
        <button className="btn btn-sm" onClick={logout}>
          Keluar
        </button>
      </div>
    </header>
  );
}
