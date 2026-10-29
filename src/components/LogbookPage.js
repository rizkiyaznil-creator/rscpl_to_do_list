"use client";

import { useState, useEffect, useCallback } from "react";
import TopBar from "@/components/TopBar";
import LogWeek from "@/components/LogWeek";
import LogTeam from "@/components/LogTeam";
import LogCategoryModal from "@/components/LogCategoryModal";
import { ROLES } from "@/lib/constants";
import { todayKey, weekStartKey } from "@/lib/logdate";

export default function LogbookPage({ currentUser }) {
  const [tab, setTab] = useState("mine");
  const [week, setWeek] = useState(() => weekStartKey(todayKey()));
  const [hasTeam, setHasTeam] = useState(false);
  const [viewUser, setViewUser] = useState(null); // personel bawahan yang sedang dibuka
  const [categories, setCategories] = useState([]);
  const [showCats, setShowCats] = useState(false);
  const isAdmin = currentUser.role === ROLES.ADMIN;

  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/log-categories");
      const data = await res.json();
      if (res.ok) setCategories(data.categories || []);
    } catch {
      /* abaikan; form tetap bisa memakai "Lainnya" */
    }
  }, []);

  useEffect(() => {
    loadCategories();
    // Tab "Logbook Bawahan" hanya untuk yang punya bawahan / akses semua.
    fetch(`/api/logbook/team?week=${todayKey()}`)
      .then((r) => r.json())
      .then((d) => setHasTeam((d.members || []).length > 0))
      .catch(() => {});
  }, [loadCategories]);

  return (
    <>
      <TopBar user={currentUser} />
      <main className="container">
        <div className="section-head" style={{ marginTop: 0 }}>
          <h2 style={{ fontSize: 20 }}>📝 Logbook Kegiatan</h2>
          <div className="spacer" />
          {isAdmin && (
            <button className="btn btn-sm" onClick={() => setShowCats(true)}>
              ⚙ Kategori baku
            </button>
          )}
        </div>

        {hasTeam && (
          <div className="tabs">
            <button
              className={`tab ${tab === "mine" ? "active" : ""}`}
              onClick={() => setTab("mine")}
            >
              Logbook Saya
            </button>
            <button
              className={`tab ${tab === "team" ? "active" : ""}`}
              onClick={() => {
                setTab("team");
                setViewUser(null);
              }}
            >
              Logbook Bawahan
            </button>
          </div>
        )}

        {tab === "mine" && (
          <LogWeek
            key={`me-${currentUser.id}`}
            userId={currentUser.id}
            week={week}
            setWeek={setWeek}
            categories={categories}
          />
        )}

        {tab === "team" &&
          (viewUser ? (
            <LogWeek
              key={`u-${viewUser.id}`}
              userId={viewUser.id}
              week={week}
              setWeek={setWeek}
              categories={categories}
              onBack={() => setViewUser(null)}
            />
          ) : (
            <LogTeam week={week} setWeek={setWeek} onOpen={setViewUser} />
          ))}
      </main>

      {showCats && (
        <LogCategoryModal
          categories={categories}
          onClose={() => setShowCats(false)}
          onChanged={loadCategories}
        />
      )}
    </>
  );
}
