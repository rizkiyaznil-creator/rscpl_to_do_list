import LoginForm from "@/components/LoginForm";

export const metadata = {
  title: "Masuk | RSCPL To-Do",
};

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="mark">✚</div>
          <div>
            <h1>RSCPL To-Do</h1>
          </div>
        </div>
        <p className="login-sub">Manajemen tugas personel rumah sakit</p>
        <LoginForm />
        <div className="login-hint">
          <strong>Akun demo:</strong>
          <br />
          Admin → <code>admin</code> / <code>admin123</code>
          <br />
          Personel → <code>dr.andi</code> / <code>password123</code>
        </div>
      </div>
    </div>
  );
}
