import { useState, useEffect } from "react";
import {
  BookOpen, Search, Plus, Trash2, ExternalLink,
  Calendar, Layers, Clock, Sparkles, BookMarked
} from "lucide-react";
import TopNav from "../../components/TopNav";

// Accent colors cycling for comic covers
const COVER_COLORS = ["#FFB5E8", "#A0E8AF", "#FBEA8C", "#CBB2FE"];
const COVER_EMOJIS = ["📄", "🔬", "💡", "🧪", "🎓", "🔭", "📊", "🧬"];

function ComicCard({ comic, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colorIdx = comic.id % COVER_COLORS.length;

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div
      data-testid={`comic-card-${comic.id}`}
      style={{
        background: "#fff",
        border: "2.5px solid #1A1A1A",
        borderRadius: "16px",
        boxShadow: "4px 4px 0 #1A1A1A",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        transition: "transform 0.1s, box-shadow 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translate(-2px,-2px)";
        e.currentTarget.style.boxShadow = "6px 6px 0 #1A1A1A";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A";
      }}
    >
      {/* Cover */}
      <div style={{
        height: "140px",
        background: COVER_COLORS[colorIdx],
        borderBottom: "2px solid #1A1A1A",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        position: "relative",
        padding: "12px",
      }}>
        {comic.cover_url ? (
          <img src={comic.cover_url} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <>
            {/* Comic panel grid preview */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", width: "80px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{
                  height: "28px",
                  background: "rgba(255,255,255,0.6)",
                  border: "1.5px solid #1A1A1A",
                  borderRadius: "4px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "14px",
                }}>
                  {COVER_EMOJIS[(comic.id + i) % COVER_EMOJIS.length]}
                </div>
              ))}
            </div>
          </>
        )}
        {/* Status badge */}
        {comic.status === "processing" && (
          <div style={{
            position: "absolute", top: "8px", right: "8px",
            background: "#FBEA8C", border: "1.5px solid #1A1A1A",
            borderRadius: "6px", padding: "2px 8px",
            fontSize: "11px", fontWeight: 700,
          }}>
            ⏳ Processing
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: "15px", color: "#1A1A1A",
          margin: "0 0 6px",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          {comic.title || comic.source_filename || "Untitled comic"}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#888", fontSize: "12px", fontWeight: 600 }}>
            <Layers size={12} /> {comic.panel_count || "?"} panels
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#888", fontSize: "12px", fontWeight: 600 }}>
            <Calendar size={12} /> {formatDate(comic.created_at)}
          </div>
          {comic.reading_time_min && (
            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#888", fontSize: "12px", fontWeight: 600 }}>
              <Clock size={12} /> {comic.reading_time_min} min read
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px" }}>
          <a
            href={`/reader/${comic.id}`}
            data-testid={`read-btn-${comic.id}`}
            style={{
              flex: 1, textAlign: "center",
              padding: "8px",
              background: "#CBB2FE", border: "2px solid #1A1A1A",
              borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
              fontFamily: "'Outfit', sans-serif", fontWeight: 800,
              fontSize: "13px", color: "#1A1A1A", textDecoration: "none",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}
          >
            <ExternalLink size={13} /> Read
          </a>
          <button
            onClick={() => setConfirmDelete(!confirmDelete)}
            data-testid={`delete-btn-${comic.id}`}
            style={{
              padding: "8px 10px",
              background: confirmDelete ? "#FF6B6B" : "#FFE4E4",
              border: "2px solid #1A1A1A",
              borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
            title="Delete"
          >
            <Trash2 size={14} color={confirmDelete ? "#fff" : "#CC0000"} />
          </button>
        </div>

        {/* Confirm delete */}
        {confirmDelete && (
          <div style={{
            marginTop: "8px",
            background: "#FFE4E4", border: "1.5px solid #FF6B6B",
            borderRadius: "8px", padding: "8px 10px",
            fontSize: "12px", color: "#CC0000", fontWeight: 700,
          }}>
            Delete this comic?{" "}
            <button
              onClick={() => onDelete(comic.id)}
              style={{
                background: "#FF6B6B", color: "#fff", border: "none",
                borderRadius: "4px", padding: "2px 8px",
                fontWeight: 800, cursor: "pointer", fontSize: "12px",
              }}
            >
              Yes
            </button>{" "}
            <button
              onClick={() => setConfirmDelete(false)}
              style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "#888" }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{ textAlign: "center", padding: "80px 24px" }}>
      <div style={{
        width: "80px", height: "80px",
        background: "#FBEA8C", border: "2.5px solid #1A1A1A",
        borderRadius: "20px", boxShadow: "4px 4px 0 #1A1A1A",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 20px",
      }}>
        <BookMarked size={36} color="#1A1A1A" />
      </div>
      <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "24px", margin: "0 0 8px" }}>
        No comics yet
      </h2>
      <p style={{ color: "#888", fontSize: "15px", fontWeight: 600, margin: "0 0 24px" }}>
        Upload your first PDF and we'll turn it into a comic in seconds.
      </p>
      <a href="/upload" style={{
        display: "inline-flex", alignItems: "center", gap: "8px",
        padding: "14px 24px",
        background: "#CBB2FE", border: "2.5px solid #1A1A1A",
        borderRadius: "12px", boxShadow: "4px 4px 0 #1A1A1A",
        fontFamily: "'Outfit', sans-serif", fontWeight: 800,
        fontSize: "16px", color: "#1A1A1A", textDecoration: "none",
      }}>
        <Plus size={18} strokeWidth={3} /> Convert your first PDF
      </a>
    </div>
  );
}

function SeriesCard({ comics, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(null);
  const first = comics[0];
  const colorIdx = first.id.length % COVER_COLORS.length;

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div
      data-testid={`series-card-${first.source_id}`}
      style={{
        background: "#fff",
        border: "2.5px solid #1A1A1A",
        borderRadius: "16px",
        boxShadow: "4px 4px 0 #1A1A1A",
        overflow: "hidden",
        display: "flex", flexDirection: "column",
        gridColumn: "span 2",
      }}
    >
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {/* Cover */}
        <div style={{
          width: "140px", flexShrink: 0,
          background: COVER_COLORS[colorIdx],
          borderRight: "2px solid #1A1A1A",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "12px",
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", width: "70px" }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} style={{
                height: "24px",
                background: "rgba(255,255,255,0.6)",
                border: "1.5px solid #1A1A1A",
                borderRadius: "4px",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px",
              }}>
                {COVER_EMOJIS[i % COVER_EMOJIS.length]}
              </div>
            ))}
          </div>
          <div style={{
            marginTop: "8px", background: "#1A1A1A", color: "#fff",
            borderRadius: "10px", padding: "2px 10px",
            fontSize: "11px", fontWeight: 700,
          }}>
            {comics.length} chapters
          </div>
        </div>

        {/* Info + chapter chips */}
        <div style={{ padding: "14px 18px", flex: 1, display: "flex", flexDirection: "column" }}>
          <h3 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: "16px", color: "#1A1A1A",
            margin: "0 0 4px",
          }}>
            {first.source_filename || "Untitled document"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#888", fontSize: "12px", fontWeight: 600, marginBottom: "10px" }}>
            <Calendar size={12} /> {formatDate(first.created_at)}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {comics.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <a
                  href={`/reader/${c.id}`}
                  data-testid={`chapter-read-btn-${c.id}`}
                  style={{
                    padding: "6px 12px",
                    background: "#FFFDF8", border: "2px solid #1A1A1A",
                    borderRadius: "16px",
                    fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                    fontSize: "12px", color: "#1A1A1A", textDecoration: "none",
                  }}
                >
                  {c.topic_title || c.title}
                </a>
                <button
                  onClick={() => setConfirmDelete(confirmDelete === c.id ? null : c.id)}
                  data-testid={`chapter-delete-btn-${c.id}`}
                  style={{
                    width: "22px", height: "22px",
                    background: "#FFE4E4", border: "1.5px solid #1A1A1A",
                    borderRadius: "50%", cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                  title="Delete chapter"
                >
                  <Trash2 size={10} color="#CC0000" />
                </button>
                {confirmDelete === c.id && (
                  <button
                    onClick={() => { onDelete(c.id); setConfirmDelete(null); }}
                    style={{
                      padding: "4px 8px", background: "#FF6B6B", color: "#fff",
                      border: "1.5px solid #1A1A1A", borderRadius: "8px",
                      fontSize: "11px", fontWeight: 700, cursor: "pointer",
                    }}
                  >
                    Confirm
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage({ user }) {
  const [comics, setComics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchComics = async () => {
      const token = localStorage.getItem("pc_token");
      try {
        const res = await fetch("/api/comics", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Failed to load library");
        const data = await res.json();
        setComics(data.comics || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchComics();
  }, []);

  const handleDelete = async (id) => {
    const token = localStorage.getItem("pc_token");
    try {
      await fetch(`/api/comics/${id}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setComics((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError("Delete failed. Try again.");
    }
  };

  const filtered = comics
    .filter((c) => {
      const q = search.toLowerCase();
      return (
        c.title?.toLowerCase().includes(q) ||
        c.source_filename?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === "oldest") return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === "panels") return (b.panel_count || 0) - (a.panel_count || 0);
      return 0;
    });

  // Group by source_id — PDFs split into multiple topic-comics share one
  // source_id and render together as a single series card.
  const groups = [];
  const seen = new Map();
  for (const c of filtered) {
    const key = c.source_id || c.id;
    if (seen.has(key)) {
      seen.get(key).push(c);
    } else {
      const arr = [c];
      seen.set(key, arr);
      groups.push(arr);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#FFFDF8", fontFamily: "'Nunito', sans-serif" }}>
      <TopNav user={user} />

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: "32px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <Sparkles size={16} color="#FBEA8C" />
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: "15px", color: "#888", fontWeight: 600 }}>
                your collection
              </span>
            </div>
            <h1 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 900,
              fontSize: "clamp(26px, 4vw, 38px)", color: "#1A1A1A",
              margin: 0, lineHeight: 1.1,
            }}>
              My Comics
              {comics.length > 0 && (
                <span style={{
                  marginLeft: "12px",
                  background: "#FFB5E8", border: "2px solid #1A1A1A",
                  borderRadius: "20px", padding: "2px 12px",
                  fontSize: "16px", fontWeight: 700, verticalAlign: "middle",
                }}>
                  {comics.length}
                </span>
              )}
            </h1>
          </div>
          <a href="/upload" style={{
            padding: "12px 20px",
            background: "#CBB2FE", border: "2.5px solid #1A1A1A",
            borderRadius: "12px", boxShadow: "4px 4px 0 #1A1A1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: "15px", color: "#1A1A1A", textDecoration: "none",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <Plus size={18} strokeWidth={3} /> New comic
          </a>
        </div>

        {/* Search + sort bar */}
        {comics.length > 0 && (
          <div style={{
            display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap",
          }}>
            <div style={{ position: "relative", flex: "1 1 260px" }}>
              <Search size={16} color="#888" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder="Search your comics…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="search-input"
                style={{
                  width: "100%", padding: "11px 12px 11px 36px",
                  border: "2.5px solid #1A1A1A", borderRadius: "10px",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                  fontSize: "14px", background: "#fff", outline: "none",
                  boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              data-testid="sort-select"
              style={{
                padding: "11px 14px",
                border: "2.5px solid #1A1A1A", borderRadius: "10px",
                fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                fontSize: "14px", background: "#fff",
              }}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="panels">Most panels</option>
            </select>
          </div>
        )}

        {error && (
          <div style={{
            background: "#FFE4E4", border: "2px solid #FF6B6B",
            borderRadius: "10px", padding: "12px 16px",
            fontSize: "14px", color: "#CC0000", fontWeight: 600, marginBottom: "20px",
          }}>
            ⚠️ {error}
          </div>
        )}

        {loading ? (
          /* Skeleton grid */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "20px" }}>
            {[...Array(6)].map((_, i) => (
              <div key={i} style={{
                background: "#fff", border: "2.5px solid #E5E5E5",
                borderRadius: "16px", overflow: "hidden",
                animation: "pulse 1.5s ease-in-out infinite",
              }}>
                <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
                <div style={{ height: "140px", background: "#F0F0F0" }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ height: "14px", background: "#F0F0F0", borderRadius: "4px", marginBottom: "8px" }} />
                  <div style={{ height: "12px", background: "#F0F0F0", borderRadius: "4px", width: "60%", marginBottom: "16px" }} />
                  <div style={{ height: "34px", background: "#F0F0F0", borderRadius: "8px" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          comics.length === 0 ? <EmptyState /> : (
            <div style={{ textAlign: "center", padding: "60px 24px", color: "#888" }}>
              <p style={{ fontSize: "16px", fontWeight: 600 }}>No comics match "{search}"</p>
            </div>
          )
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "20px",
          }}>
            {groups.map((group) =>
              group.length > 1 ? (
                <SeriesCard key={group[0].source_id} comics={group} onDelete={handleDelete} />
              ) : (
                <ComicCard key={group[0].id} comic={group[0]} onDelete={handleDelete} />
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}