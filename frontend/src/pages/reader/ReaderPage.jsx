import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, BookOpen, Grid,
  Maximize2, Minimize2, ArrowLeft, Share2,
  Download, Sparkles
} from "lucide-react";

// ── Reading modes ──────────────────────────────────────────────────────────
const MODE = { STRIP: "strip", GRID: "grid", FULLSCREEN: "fullscreen" };

// Accent colors for panels
const PANEL_BG = ["#FFB5E8", "#A0E8AF", "#FBEA8C", "#CBB2FE"];
const PANEL_EMOJI = ["😮", "💡", "🔬", "✨", "🎯", "🧪", "🎓", "🔭"];

// ── Single panel component ─────────────────────────────────────────────────
function Panel({ panel, index, isCurrent, onClick, mode }) {
  const isGrid = mode === MODE.GRID;
  const bg = PANEL_BG[index % PANEL_BG.length];

  return (
    <div
      onClick={onClick}
      data-testid={`panel-${index}`}
      style={{
        background: "#fff",
        border: `${isCurrent && !isGrid ? "3px" : "2.5px"} solid #1A1A1A`,
        borderRadius: "14px",
        boxShadow: isCurrent && !isGrid ? "6px 6px 0 #CBB2FE" : "4px 4px 0 #1A1A1A",
        overflow: "hidden",
        cursor: isGrid ? "pointer" : "default",
        transition: "transform 0.1s, box-shadow 0.1s",
        ...(isGrid ? {} : {}),
      }}
    >
      {/* Image */}
      <div style={{
        background: bg,
        borderBottom: "2px solid #1A1A1A",
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: isGrid ? "140px" : "320px",
        position: "relative",
      }}>
        {panel.image_url ? (
          <img
            src={panel.image_url}
            alt={`Panel ${index + 1}`}
            style={{ width: "100%", display: "block", maxHeight: isGrid ? "140px" : "320px", objectFit: "contain" }}
          />
        ) : (
          <div style={{
            fontSize: isGrid ? "36px" : "64px",
            filter: "drop-shadow(2px 2px 0 rgba(0,0,0,0.15))",
          }}>
            {PANEL_EMOJI[index % PANEL_EMOJI.length]}
          </div>
        )}
        {/* Panel number badge */}
        <div style={{
          position: "absolute", top: "10px", left: "10px",
          background: "#1A1A1A", color: "#fff",
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: isGrid ? "11px" : "13px",
          padding: "2px 8px", borderRadius: "6px",
        }}>
          {index + 1}
        </div>
      </div>

      {/* Text */}
      <div style={{ padding: isGrid ? "10px 12px" : "18px 20px" }}>
        {panel.caption && (
          <p style={{
            fontFamily: "'Nunito', sans-serif",
            fontWeight: 700,
            fontSize: isGrid ? "12px" : "15px",
            color: "#333", margin: "0 0 8px",
            lineHeight: 1.5,
          }}>
            {panel.caption}
          </p>
        )}
        {panel.dialogue && !isGrid && (
          <div style={{
            background: "#FFFDF8", border: "2px solid #1A1A1A",
            borderRadius: "10px", padding: "10px 14px",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "14px", color: "#555",
            fontStyle: "italic", fontWeight: 600,
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: "-8px", left: "16px",
              width: "14px", height: "14px",
              background: "#FFFDF8", border: "2px solid #1A1A1A",
              borderRadius: "50%",
            }} />
            "{panel.dialogue}"
          </div>
        )}
        {panel.scene_description && !isGrid && (
          <div style={{
            marginTop: "10px",
            fontFamily: "'Caveat', cursive", fontSize: "14px",
            color: "#888", fontWeight: 600,
          }}>
            🎬 {panel.scene_description}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReaderPage({ comicId, user }) {
  const [comic, setComic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentPanel, setCurrentPanel] = useState(0);
  const [mode, setMode] = useState(MODE.STRIP);
  const [shareMsg, setShareMsg] = useState("");

  useEffect(() => {
    const fetchComic = async () => {
      const token = localStorage.getItem("pc_token");
      try {
        const res = await fetch(`${process.env.REACT_APP_API_BASE}/api/comics/${comicId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error("Comic not found");
        const data = await res.json();
        setComic(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (comicId) fetchComic();
  }, [comicId]);

  // Keyboard navigation
  const handleKey = useCallback((e) => {
    if (!comic) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      setCurrentPanel((p) => Math.min(p + 1, comic.panels.length - 1));
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      setCurrentPanel((p) => Math.max(p - 1, 0));
    }
    if (e.key === "Escape" && mode === MODE.FULLSCREEN) {
      setMode(MODE.STRIP);
    }
  }, [comic, mode]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShareMsg("Link copied!");
      setTimeout(() => setShareMsg(""), 2000);
    } catch {
      setShareMsg(url);
    }
  };

  const panels = comic?.panels || [];
  const pct = panels.length ? Math.round(((currentPanel + 1) / panels.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFDF8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "64px", height: "64px",
            background: "#CBB2FE", border: "3px solid #1A1A1A",
            borderRadius: "16px", boxShadow: "4px 4px 0 #1A1A1A",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
            animation: "spin 1.5s linear infinite",
          }}>
            <BookOpen size={28} color="#1A1A1A" />
          </div>
          <style>{`@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
          <p style={{ fontFamily: "'Caveat', cursive", fontSize: "18px", color: "#888" }}>Loading your comic…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#FFFDF8", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Nunito', sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: "360px" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>😔</div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 8px" }}>Comic not found</h2>
          <p style={{ color: "#888", marginBottom: "20px" }}>{error}</p>
          <a href="/library" style={{
            padding: "10px 20px", background: "#CBB2FE",
            border: "2.5px solid #1A1A1A", borderRadius: "10px",
            boxShadow: "3px 3px 0 #1A1A1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: "14px", color: "#1A1A1A", textDecoration: "none",
          }}>
            Back to library
          </a>
        </div>
      </div>
    );
  }

  const isFullscreen = mode === MODE.FULLSCREEN;

  return (
    <div style={{
      minHeight: "100vh",
      background: isFullscreen ? "#1A1A1A" : "#FFFDF8",
      fontFamily: "'Nunito', sans-serif",
      transition: "background 0.3s",
    }}>
      {/* ── Top bar ── */}
      {!isFullscreen && (
        <nav style={{
          position: "sticky", top: 0, zIndex: 100,
          background: "#FFFDF8", borderBottom: "2.5px solid #1A1A1A",
          padding: "0 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: "60px",
        }}>
          <a href="/library" style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontFamily: "'Outfit', sans-serif", fontWeight: 700,
            fontSize: "14px", color: "#555", textDecoration: "none",
          }}>
            <ArrowLeft size={16} strokeWidth={2.5} /> Library
          </a>

          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: "16px", color: "#1A1A1A", margin: 0,
            maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {comic?.title || "Untitled"}
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {/* Mode toggle */}
            <button
              onClick={() => setMode(mode === MODE.STRIP ? MODE.GRID : MODE.STRIP)}
              data-testid="mode-toggle"
              title={mode === MODE.STRIP ? "Grid view" : "Strip view"}
              style={{
                padding: "7px 10px",
                background: "#FBEA8C", border: "2px solid #1A1A1A",
                borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
                cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              <Grid size={16} color="#1A1A1A" />
            </button>
            {/* Fullscreen */}
            <button
              onClick={() => setMode(MODE.FULLSCREEN)}
              data-testid="fullscreen-btn"
              title="Fullscreen"
              style={{
                padding: "7px 10px",
                background: "#A0E8AF", border: "2px solid #1A1A1A",
                borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
                cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              <Maximize2 size={16} color="#1A1A1A" />
            </button>
            {/* Share */}
            <button
              onClick={handleShare}
              data-testid="share-btn"
              title="Copy link"
              style={{
                padding: "7px 10px",
                background: "#FFB5E8", border: "2px solid #1A1A1A",
                borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
                cursor: "pointer", display: "flex", alignItems: "center",
              }}
            >
              <Share2 size={16} color="#1A1A1A" />
            </button>
          </div>
        </nav>
      )}

      {/* Share feedback */}
      {shareMsg && (
        <div style={{
          position: "fixed", top: "72px", right: "24px", zIndex: 200,
          background: "#A0E8AF", border: "2px solid #1A1A1A",
          borderRadius: "10px", boxShadow: "3px 3px 0 #1A1A1A",
          padding: "10px 16px", fontWeight: 700, fontSize: "14px",
        }}>
          ✓ {shareMsg}
        </div>
      )}

      <main style={{
        maxWidth: isFullscreen ? "100vw" : mode === MODE.GRID ? "1100px" : "720px",
        margin: "0 auto",
        padding: isFullscreen ? "0" : "32px 24px 80px",
      }}>
        {/* ── STRIP MODE ── */}
        {mode === MODE.STRIP && panels.length > 0 && (
          <>
            {/* Progress */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#888", fontWeight: 600 }}>
                  Panel {currentPanel + 1} of {panels.length}
                </span>
                <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "13px", color: "#888" }}>
                  {pct}% read
                </span>
              </div>
              <div style={{ height: "10px", background: "#F0F0F0", border: "2px solid #1A1A1A", borderRadius: "6px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: "#CBB2FE",
                  borderRight: pct < 100 ? "2px solid #1A1A1A" : "none",
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>

            {/* Current panel */}
            <Panel panel={panels[currentPanel]} index={currentPanel} isCurrent mode={MODE.STRIP} />

            {/* Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "24px" }}>
              <button
                onClick={() => setCurrentPanel((p) => Math.max(p - 1, 0))}
                disabled={currentPanel === 0}
                data-testid="prev-panel-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "12px 20px",
                  background: currentPanel === 0 ? "#F0F0F0" : "#FFFDF8",
                  border: "2.5px solid #1A1A1A",
                  borderRadius: "10px", boxShadow: currentPanel === 0 ? "none" : "3px 3px 0 #1A1A1A",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                  fontSize: "14px", color: currentPanel === 0 ? "#aaa" : "#1A1A1A",
                  cursor: currentPanel === 0 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft size={18} /> Previous
              </button>

              {/* Panel dots */}
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center", maxWidth: "220px" }}>
                {panels.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPanel(i)}
                    data-testid={`dot-${i}`}
                    style={{
                      width: i === currentPanel ? "20px" : "10px",
                      height: "10px",
                      background: i === currentPanel ? "#CBB2FE" : "#CCC",
                      border: "1.5px solid #1A1A1A",
                      borderRadius: "5px",
                      padding: 0, cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                  />
                ))}
              </div>

              <button
                onClick={() => setCurrentPanel((p) => Math.min(p + 1, panels.length - 1))}
                disabled={currentPanel === panels.length - 1}
                data-testid="next-panel-btn"
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "12px 20px",
                  background: currentPanel === panels.length - 1 ? "#F0F0F0" : "#CBB2FE",
                  border: "2.5px solid #1A1A1A",
                  borderRadius: "10px", boxShadow: currentPanel === panels.length - 1 ? "none" : "3px 3px 0 #1A1A1A",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                  fontSize: "14px", color: currentPanel === panels.length - 1 ? "#aaa" : "#1A1A1A",
                  cursor: currentPanel === panels.length - 1 ? "not-allowed" : "pointer",
                }}
              >
                Next <ChevronRight size={18} />
              </button>
            </div>

            {/* Keyboard hint */}
            <p style={{ textAlign: "center", marginTop: "16px", fontFamily: "'Caveat', cursive", fontSize: "14px", color: "#bbb" }}>
              ← → arrow keys to navigate
            </p>

            {/* Done state */}
            {currentPanel === panels.length - 1 && (
              <div style={{
                marginTop: "32px",
                background: "#A0E8AF", border: "3px solid #1A1A1A",
                borderRadius: "16px", boxShadow: "5px 5px 0 #1A1A1A",
                padding: "28px 24px", textAlign: "center",
              }}>
                <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎉</div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 8px" }}>
                  You finished the comic!
                </h2>
                <p style={{ color: "#333", fontWeight: 600, margin: "0 0 20px" }}>
                  Now you actually know what that paper was about.
                </p>
                <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap" }}>
                  <a href="/upload" style={{
                    padding: "12px 20px",
                    background: "#CBB2FE", border: "2.5px solid #1A1A1A",
                    borderRadius: "10px", boxShadow: "3px 3px 0 #1A1A1A",
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                    fontSize: "14px", color: "#1A1A1A", textDecoration: "none",
                  }}>
                    Convert another PDF
                  </a>
                  <button
                    onClick={handleShare}
                    style={{
                      padding: "12px 20px",
                      background: "#FFFDF8", border: "2.5px solid #1A1A1A",
                      borderRadius: "10px", boxShadow: "3px 3px 0 #1A1A1A",
                      fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                      fontSize: "14px", color: "#1A1A1A", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: "6px",
                    }}
                  >
                    <Share2 size={14} /> Share this comic
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── GRID MODE ── */}
        {mode === MODE.GRID && panels.length > 0 && (
          <>
            <div style={{ marginBottom: "24px" }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
                {comic?.title}
              </h2>
              <p style={{ color: "#888", fontSize: "14px", fontWeight: 600, margin: 0 }}>
                {panels.length} panels · click any panel to read from there
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {panels.map((panel, i) => (
                <Panel
                  key={i}
                  panel={panel}
                  index={i}
                  isCurrent={i === currentPanel}
                  mode={MODE.GRID}
                  onClick={() => { setCurrentPanel(i); setMode(MODE.STRIP); }}
                />
              ))}
            </div>
          </>
        )}

        {/* ── FULLSCREEN MODE ── */}
        {mode === MODE.FULLSCREEN && panels.length > 0 && (
          <div style={{
            minHeight: "100vh",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            padding: "24px",
            position: "relative",
          }}>
            {/* Exit fullscreen */}
            <button
              onClick={() => setMode(MODE.STRIP)}
              data-testid="exit-fullscreen-btn"
              style={{
                position: "fixed", top: "16px", right: "16px",
                background: "#FFFDF8", border: "2px solid #fff",
                borderRadius: "8px", padding: "8px",
                cursor: "pointer", display: "flex", alignItems: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              <Minimize2 size={20} color="#1A1A1A" />
            </button>

            {/* Panel */}
            <div style={{ maxWidth: "700px", width: "100%" }}>
              <Panel panel={panels[currentPanel]} index={currentPanel} isCurrent mode={MODE.FULLSCREEN} />
            </div>

            {/* FS navigation */}
            <div style={{ display: "flex", gap: "16px", marginTop: "24px", alignItems: "center" }}>
              <button
                onClick={() => setCurrentPanel((p) => Math.max(p - 1, 0))}
                disabled={currentPanel === 0}
                style={{
                  width: "48px", height: "48px",
                  background: currentPanel === 0 ? "rgba(255,255,255,0.1)" : "#fff",
                  border: "2px solid #fff",
                  borderRadius: "50%", cursor: currentPanel === 0 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronLeft size={22} color={currentPanel === 0 ? "#555" : "#1A1A1A"} />
              </button>
              <span style={{ color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "15px" }}>
                {currentPanel + 1} / {panels.length}
              </span>
              <button
                onClick={() => setCurrentPanel((p) => Math.min(p + 1, panels.length - 1))}
                disabled={currentPanel === panels.length - 1}
                style={{
                  width: "48px", height: "48px",
                  background: currentPanel === panels.length - 1 ? "rgba(255,255,255,0.1)" : "#fff",
                  border: "2px solid #fff",
                  borderRadius: "50%", cursor: currentPanel === panels.length - 1 ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <ChevronRight size={22} color={currentPanel === panels.length - 1 ? "#555" : "#1A1A1A"} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}