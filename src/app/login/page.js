import Link from "next/link";
import LoginForm from "@/components/LoginForm";
import { hospital } from "@/lib/hospitalProfile";

export const metadata = {
  title: `Masuk | ${hospital.name}`,
};

// Hanya path internal ("/tugas?task=5"), bukan alamat situs lain ("//evil.com").
function safeNext(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export default async function LoginPage({ searchParams }) {
  const next = safeNext((await searchParams)?.next);
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <img className="mark" src="/logo-rsusu.png" alt="Logo RS CPL USU" />
          <div>
            <h1>{hospital.name}</h1>
          </div>
        </div>
        <p className="login-sub">Manajemen tugas personel rumah sakit</p>
        <LoginForm next={next} />
        {process.env.NODE_ENV !== "production" && (
          <div className="login-hint">
            <strong>Akun demo:</strong>
            <br />
            Admin → <code>admin</code> / <code>admin123</code>
            <br />
            Personel → <code>dr.andi</code> / <code>password123</code>
          </div>
        )}
        <p style={{ textAlign: "center", marginTop: 14, marginBottom: 6 }}>
          <Link href="/lupa-password" style={{ fontSize: 13 }}>
            Lupa password?
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 0, marginBottom: 6 }}>
          Belum punya akun?{" "}
          <Link href="/daftar" style={{ fontSize: 13 }}>
            Daftar di sini
          </Link>
        </p>
        <p style={{ textAlign: "center", marginTop: 0, marginBottom: 0 }}>
          <Link href="/" style={{ fontSize: 13 }}>
            ← Kembali ke profil RS
          </Link>
        </p>
      </div>
    </div>
  );
}
