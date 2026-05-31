import Link from "next/link";
import { getSession } from "@/lib/auth";
import { hospital, MILESTONE_STATUS } from "@/lib/hospitalProfile";

export const metadata = {
  title: `${hospital.fullName} | Profil & Visi Misi`,
};

// Halaman awal publik: profil RS (visi, misi, falsafah, milestone).
export default async function Home() {
  const session = await getSession();

  return (
    <div className="landing">
      {/* ---------- Hero ---------- */}
      <header className="lp-hero">
        <nav className="lp-nav">
          <div className="brand" style={{ color: "#fff" }}>
            <span className="mark">✚</span>
            <span>
              {hospital.name}
              <small style={{ color: "rgba(255,255,255,.8)" }}>
                {hospital.fullName}
              </small>
            </span>
          </div>
          <div className="spacer" />
          {session ? (
            <Link href="/dashboard" className="btn">
              Buka Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn">
              Masuk
            </Link>
          )}
        </nav>

        <div className="lp-hero-body">
          <h1>{hospital.fullName}</h1>
          <p>{hospital.tagline}</p>
          <Link
            href={session ? "/dashboard" : "/login"}
            className="btn btn-primary btn-lg"
          >
            {session ? "Buka Dashboard →" : "Masuk ke Sistem →"}
          </Link>
        </div>
      </header>

      <main className="lp-main">
        {/* ---------- Visi & Misi ---------- */}
        <section className="lp-section">
          <div className="lp-grid-2">
            <div className="lp-card lp-visi">
              <span className="lp-eyebrow">Visi</span>
              <p>{hospital.visi}</p>
            </div>
            <div className="lp-card">
              <span className="lp-eyebrow">Misi</span>
              <ol className="lp-misi">
                {hospital.misi.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* ---------- Moto CAREST ---------- */}
        <section className="lp-section">
          <div className="lp-falsafah">
            <span className="lp-eyebrow center">{hospital.moto.subtitle}</span>
            <div className="carest-acronym" aria-label={`Moto ${hospital.moto.name}`}>
              {hospital.moto.values.map((v) => (
                <span className="carest-letter" key={v.letter}>
                  {v.letter}
                </span>
              ))}
            </div>
            <div className="lp-values carest-grid">
              {hospital.moto.values.map((v) => (
                <div className="lp-value" key={v.letter}>
                  <div className="lp-value-mark">{v.letter}</div>
                  <div>
                    <b>
                      {v.label}{" "}
                      <span className="carest-id">({v.labelId})</span>
                    </b>
                    <p>{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- Timeline / Milestone ---------- */}
        <section className="lp-section">
          <span className="lp-eyebrow center">Timeline &amp; Milestone</span>
          <h2 className="lp-h2">Pencapaian yang Kami Tuju</h2>
          <ol className="timeline">
            {hospital.milestones.map((m, i) => {
              const st = MILESTONE_STATUS[m.status] || MILESTONE_STATUS.planned;
              return (
                <li key={i} className={`tl-item ${st.className}`}>
                  <div className="tl-marker">
                    <span className="tl-dot" />
                  </div>
                  <div className="tl-content">
                    <div className="tl-top">
                      <span className="tl-year">{m.year}</span>
                      <span className={`badge tl-badge ${st.className}`}>
                        {st.label}
                      </span>
                    </div>
                    <h3>{m.title}</h3>
                    <p>{m.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      </main>

      <footer className="lp-footer">
        <p>
          © {new Date().getFullYear()} {hospital.fullName}. Sistem Manajemen Tugas
          Personel.
        </p>
        <Link href={session ? "/dashboard" : "/login"}>
          {session ? "Buka Dashboard" : "Masuk"}
        </Link>
      </footer>
    </div>
  );
}
