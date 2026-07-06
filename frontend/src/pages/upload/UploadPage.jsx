import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, FileText, Zap, BookOpen, ArrowRight,
  X, ChevronDown, ChevronUp, Sparkles, RotateCcw,
  AlertTriangle, CheckCircle2, Eye, Lightbulb, Microscope, Target
} from "lucide-react";
import TopNav from "../../components/TopNav";

// ── Stage constants ─────────────────────────────────────────────────────────
const STAGES = {
  IDLE: "idle",
  UPLOADING: "uploading",
  OUTLINING: "outlining",
  CHOOSING_TOPICS: "choosing_topics",
  SCRIPTING: "scripting",
  ILLUSTRATING: "illustrating",
  DONE: "done",
  ERROR: "error",
};

const STAGE_LABELS = {
  uploading: "Reading your PDF…",
  outlining: "Finding the major topics…",
  scripting: "PaperComic is writing the comic script…",
  illustrating: "Painting the panels…",
  done: "Your comic is ready!",
};

// ── Progress bar ────────────────────────────────────────────────────────────
function ProgressBar({ stage }) {
  const pct = { uploading: 10, outlining: 25, choosing_topics: 30, scripting: 55, illustrating: 85, done: 100 }[stage] ?? 0;
  const color = { uploading: "#FBEA8C", outlining: "#FBEA8C", choosing_topics: "#FBEA8C", scripting: "#CBB2FE", illustrating: "#FFB5E8", done: "#A0E8AF" }[stage] ?? "#E5E5E5";
  return (
    <div style={{ width: "100%", marginTop: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", fontWeight: 600, color: "#555" }}>
          {STAGE_LABELS[stage] ?? ""}
        </span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "14px", color: "#888" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: "14px", background: "#F0F0F0", border: "2px solid #1A1A1A", borderRadius: "8px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`,
          background: color,
          borderRight: pct < 100 ? "2px solid #1A1A1A" : "none",
          transition: "width 0.6s ease, background 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ── Comic panel preview card ────────────────────────────────────────────────
function PanelCard({ panel, index }) {
  return (
    <div style={{
      background: "#fff",
      border: "2.5px solid #1A1A1A",
      borderRadius: "14px",
      boxShadow: "4px 4px 0 #1A1A1A",
      overflow: "hidden",
      breakInside: "avoid",
      opacity: 0,
      animation: "panelIn 0.5s ease forwards",
      animationDelay: `${index * 0.08}s`,
    }}>
      {panel.image_url ? (
        <img
          src={panel.image_url}
          alt={`Panel ${index + 1}`}
          style={{ width: "100%", display: "block", borderBottom: "2px solid #1A1A1A" }}
        />
      ) : (
        <div style={{
          height: "160px",
          background: ["#FFB5E8", "#A0E8AF", "#FBEA8C", "#CBB2FE", "#FFB5E8"][index % 5],
          display: "flex", alignItems: "center", justifyContent: "center",
          borderBottom: "2px solid #1A1A1A",
        }}>
          {[
            <Eye size={36} color="#1A1A1A" strokeWidth={1.8} />,
            <Lightbulb size={36} color="#1A1A1A" strokeWidth={1.8} />,
            <Microscope size={36} color="#1A1A1A" strokeWidth={1.8} />,
            <Sparkles size={36} color="#1A1A1A" strokeWidth={1.8} />,
            <Target size={36} color="#1A1A1A" strokeWidth={1.8} />,
          ][index % 5]}
        </div>
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{
          fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "13px",
          color: "#888", marginBottom: "4px",
        }}>
          Panel {index + 1}
        </div>
        {panel.caption && (
          <p style={{
            fontFamily: "'Nunito', sans-serif", fontSize: "13px",
            color: "#333", margin: 0, lineHeight: 1.5, fontWeight: 600,
          }}>
            {panel.caption}
          </p>
        )}
        {panel.dialogue && (
          <div style={{
            marginTop: "8px",
            background: "#FFFDF8",
            border: "1.5px solid #CCC",
            borderRadius: "8px",
            padding: "6px 10px",
            fontFamily: "'Nunito', sans-serif",
            fontSize: "12px",
            color: "#555",
            fontStyle: "italic",
          }}>
            "{panel.dialogue}"
          </div>
        )}
      </div>
    </div>
  );
}

class UpgradeRequiredError extends Error {
  constructor(detail) {
    super(detail?.message || "Upgrade required");
    this.name = "UpgradeRequiredError";
    this.detail = detail;
  }
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function UploadPage({ user, onNavigate }) {
  const [stage, setStage] = useState(STAGES.IDLE);
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [panels, setPanels] = useState([]);
  const [comicId, setComicId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState({ style: "manga", panels: 8, language: "en" });
  const [splitByTopic, setSplitByTopic] = useState(true);
  const [topics, setTopics] = useState([]);
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [pdfB64, setPdfB64] = useState(null);
  const [sourceId, setSourceId] = useState(null);
  const [completedComics, setCompletedComics] = useState([]); // [{comic_id, topic_title, panels}]
  const [usage, setUsage] = useState(null); // { plan, free_generations_used, free_generation_limit, is_premium }
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const fileInputRef = useRef(null);

  const fetchUsage = useCallback(async () => {
    const token = localStorage.getItem("pc_token");
    if (!token) return;
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsage(data);
      }
    } catch {
      // Non-critical -usage badge just won't show if this fails.
    }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === "application/pdf") {
      setFile(dropped);
    } else {
      setErrorMsg("Please drop a PDF file.");
    }
  }, []);

  const handleFileChange = (e) => {
    const picked = e.target.files[0];
    if (picked) setFile(picked);
  };

  const reset = () => {
    setStage(STAGES.IDLE);
    setFile(null);
    setPanels([]);
    setComicId(null);
    setErrorMsg("");
    setTopics([]);
    setSelectedTopicIds([]);
    setPdfB64(null);
    setSourceId(null);
    setCompletedComics([]);
  };

  // Single-document flow (original behavior, unchanged)
  const convertWholeDocument = async () => {
    const token = localStorage.getItem("pc_token");
    const formData = new FormData();
    formData.append("file", file);
    formData.append("style", options.style);
    formData.append("panel_count", options.panels);
    formData.append("language", options.language);

    setStage(STAGES.SCRIPTING);
    const scriptRes = await fetch("/api/convert/script", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!scriptRes.ok) {
      const e = await scriptRes.json();
      throw new Error(e.detail || "Script generation failed");
    }
    const scriptData = await scriptRes.json();

    setStage(STAGES.ILLUSTRATING);
    const illustrateRes = await fetch("/api/convert/illustrate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ comic_id: scriptData.comic_id, panels: scriptData.panels }),
    });
    if (!illustrateRes.ok) {
      const e = await illustrateRes.json();
      if (illustrateRes.status === 402) {
        throw new UpgradeRequiredError(e.detail);
      }
      throw new Error(typeof e.detail === "string" ? e.detail : "Illustration failed");
    }
    const finalData = await illustrateRes.json();

    setPanels(finalData.panels);
    setComicId(finalData.comic_id);
    setUsage((prev) => ({
      ...prev,
      plan: finalData.plan,
      free_generations_used: finalData.free_generations_used,
      free_generation_limit: finalData.free_generation_limit,
      is_premium: finalData.is_premium,
    }));
    setStage(STAGES.DONE);
  };

  // Step 1 of multi-topic flow: get the outline
  const fetchOutline = async () => {
    const token = localStorage.getItem("pc_token");
    const formData = new FormData();
    formData.append("file", file);

    setStage(STAGES.OUTLINING);
    const res = await fetch("/api/convert/outline", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const e = await res.json();
      throw new Error(e.detail || "Outline generation failed");
    }
    const data = await res.json();
    setTopics(data.topics);
    setSelectedTopicIds(data.topics.map((t) => t.topic_id)); // default: all selected
    setPdfB64(data.pdf_b64);
    setSourceId(data.source_id);
    setStage(STAGES.CHOOSING_TOPICS);
  };

  // Step 2 of multi-topic flow: generate a script + illustration per selected topic
  const generateSelectedTopics = async () => {
    const token = localStorage.getItem("pc_token");
    const selected = topics.filter((t) => selectedTopicIds.includes(t.topic_id));
    const results = [];

    try {
      for (const topic of selected) {
        setStage(STAGES.SCRIPTING);
        const formData = new FormData();
        formData.append("pdf_b64", pdfB64 || "");
        formData.append("filename", file?.name || "document.pdf");
        formData.append("style", options.style);
        formData.append("panel_count", options.panels);
        formData.append("language", options.language);
        formData.append("topic_title", topic.title);
        formData.append("topic_summary", topic.summary);
        formData.append("source_id", sourceId || "");

        const scriptRes = await fetch("/api/convert/script", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });
        if (!scriptRes.ok) {
          const e = await scriptRes.json();
          throw new Error(`"${topic.title}": ${e.detail || "Script generation failed"}`);
        }
        const scriptData = await scriptRes.json();

        setStage(STAGES.ILLUSTRATING);
        const illustrateRes = await fetch("/api/convert/illustrate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ comic_id: scriptData.comic_id, panels: scriptData.panels }),
        });
        if (!illustrateRes.ok) {
          const e = await illustrateRes.json();
          if (illustrateRes.status === 402) {
            throw new UpgradeRequiredError(e.detail);
          }
          throw new Error(`"${topic.title}": ${typeof e.detail === "string" ? e.detail : "Illustration failed"}`);
        }
        const finalData = await illustrateRes.json();

        setUsage((prev) => ({
          ...prev,
          plan: finalData.plan,
          free_generations_used: finalData.free_generations_used,
          free_generation_limit: finalData.free_generation_limit,
          is_premium: finalData.is_premium,
        }));

        results.push({
          comic_id: finalData.comic_id,
          topic_title: topic.title,
          panels: finalData.panels,
        });
      }

      setCompletedComics(results);
      // Show the first chapter's panels by default in the DONE view
      setPanels(results[0]?.panels || []);
      setComicId(results[0]?.comic_id || null);
      setStage(STAGES.DONE);
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        setShowUpgradeModal(true);
        setStage(STAGES.IDLE);
        return;
      }
      setErrorMsg(err.message);
      setStage(STAGES.ERROR);
    }
  };

  const convert = async () => {
    if (!file) return;
    try {
      setStage(STAGES.UPLOADING);
      await new Promise((r) => setTimeout(r, 400));

      if (splitByTopic) {
        await fetchOutline();
      } else {
        await convertWholeDocument();
      }
    } catch (err) {
      if (err instanceof UpgradeRequiredError) {
        setShowUpgradeModal(true);
        setStage(STAGES.IDLE);
        return;
      }
      setErrorMsg(err.message);
      setStage(STAGES.ERROR);
    }
  };

  const toggleTopic = (topicId) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  const isProcessing = [STAGES.UPLOADING, STAGES.OUTLINING, STAGES.SCRIPTING, STAGES.ILLUSTRATING].includes(stage);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFDF8", fontFamily: "'Nunito', sans-serif" }}>
      <TopNav user={user} usage={usage} />

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Page header */}
        <div style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Sparkles size={18} color="#CBB2FE" />
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#888", fontWeight: 600 }}>
              powered by PaperComic
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "clamp(28px, 5vw, 42px)", color: "#1A1A1A",
            margin: 0, lineHeight: 1.1,
          }}>
            Upload your PDF
          </h1>
          <p style={{ color: "#666", fontSize: "16px", marginTop: "10px", fontWeight: 600 }}>
            Drop any research paper, textbook chapter, or article -we'll turn it into a comic in under 60 seconds.
          </p>
        </div>

        {/* ── IDLE / FILE SELECTED ── */}
        {(stage === STAGES.IDLE || stage === STAGES.ERROR) && (
          <>
            {/* Drop zone */}
            <div
              data-testid="drop-zone"
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              style={{
                border: `3px dashed ${isDragging ? "#CBB2FE" : file ? "#A0E8AF" : "#1A1A1A"}`,
                borderRadius: "20px",
                background: isDragging ? "#F0EAFF" : file ? "#F0FFF4" : "#fff",
                padding: "48px 24px",
                textAlign: "center",
                cursor: file ? "default" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: isDragging ? "6px 6px 0 #CBB2FE" : "none",
                position: "relative",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{ display: "none" }}
                data-testid="file-input"
              />

              {!file ? (
                <>
                  <div style={{
                    width: "72px", height: "72px",
                    background: "#FFB5E8", border: "2.5px solid #1A1A1A",
                    borderRadius: "18px", boxShadow: "4px 4px 0 #1A1A1A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 20px",
                  }}>
                    <Upload size={32} color="#1A1A1A" strokeWidth={2} />
                  </div>
                  <h2 style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                    fontSize: "22px", color: "#1A1A1A", margin: "0 0 8px",
                  }}>
                    Drop your PDF here
                  </h2>
                  <p style={{ color: "#888", fontSize: "15px", margin: "0 0 20px", fontWeight: 600 }}>
                    or click to browse -max 50 MB
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: "8px", flexWrap: "wrap" }}>
                    {["Research papers", "Textbook chapters", "Articles"].map((tag) => (
                      <span key={tag} style={{
                        background: "#FBEA8C", border: "2px solid #1A1A1A",
                        borderRadius: "20px", padding: "4px 12px",
                        fontSize: "12px", fontWeight: 700, color: "#1A1A1A",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                /* File selected state */
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px" }}>
                  <div style={{
                    width: "52px", height: "52px",
                    background: "#A0E8AF", border: "2.5px solid #1A1A1A",
                    borderRadius: "12px", boxShadow: "3px 3px 0 #1A1A1A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <FileText size={26} color="#1A1A1A" />
                  </div>
                  <div style={{ textAlign: "left" }}>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                      fontSize: "16px", color: "#1A1A1A",
                      maxWidth: "260px", overflow: "hidden",
                      textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#888", fontWeight: 600 }}>
                      {(file.size / 1024 / 1024).toFixed(2)} MB · PDF
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); reset(); }}
                    style={{
                      background: "#FFE4E4", border: "2px solid #1A1A1A",
                      borderRadius: "8px", padding: "6px",
                      cursor: "pointer", display: "flex", alignItems: "center",
                    }}
                  >
                    <X size={16} color="#CC0000" />
                  </button>
                </div>
              )}
            </div>

            {errorMsg && (
              <div data-testid="error-msg" style={{
                marginTop: "16px",
                background: "#FFE4E4", border: "2px solid #FF6B6B",
                borderRadius: "10px", padding: "12px 16px",
                fontSize: "14px", color: "#CC0000", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <AlertTriangle size={16} color="#CC0000" strokeWidth={2} /> {errorMsg}
              </div>
            )}

            {/* Split by topic -shown prominently since it's the recommended default */}
            <label
              data-testid="split-by-topic-label"
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                marginTop: "16px", padding: "14px 16px",
                background: splitByTopic ? "#FFFDF8" : "#fff",
                border: `2.5px solid ${splitByTopic ? "#1A1A1A" : "#E5E5E5"}`,
                borderRadius: "12px", cursor: "pointer",
                fontWeight: 700, fontSize: "14px", color: "#1A1A1A",
                boxShadow: splitByTopic ? "3px 3px 0 #1A1A1A" : "none",
                transition: "all 0.15s",
              }}
            >
              <input
                type="checkbox"
                checked={splitByTopic}
                onChange={(e) => setSplitByTopic(e.target.checked)}
                data-testid="split-by-topic-checkbox"
                style={{ width: "18px", height: "18px", accentColor: "#CBB2FE", flexShrink: 0 }}
              />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}><BookOpen size={16} /> Split into one comic per major topic</div>
                <div style={{ fontSize: "12px", color: "#888", fontWeight: 600, marginTop: "2px" }}>
                  Recommended -each topic gets {options.panels} panels of detailed coverage
                </div>
              </div>
            </label>

            {/* Advanced options toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                marginTop: "20px",
                background: "none", border: "none",
                display: "flex", alignItems: "center", gap: "6px",
                fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                fontSize: "14px", color: "#888", cursor: "pointer",
              }}
            >
              {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Advanced options
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: "12px",
                background: "#fff", border: "2.5px solid #1A1A1A",
                borderRadius: "14px", boxShadow: "4px 4px 0 #1A1A1A",
                padding: "20px 24px",
                display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "16px",
              }}>
                {/* Style */}
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", marginBottom: "6px", color: "#1A1A1A" }}>
                    Comic style
                  </label>
                  <select
                    value={options.style}
                    onChange={(e) => setOptions({ ...options, style: e.target.value })}
                    data-testid="style-select"
                    style={{
                      width: "100%", padding: "9px 12px",
                      border: "2px solid #1A1A1A", borderRadius: "8px",
                      fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                      fontSize: "14px", background: "#FFFDF8",
                    }}
                  >
                    <option value="manga">Manga / sketch</option>
                    <option value="infographic">Infographic</option>
                    <option value="storyboard">Storyboard</option>
                  </select>
                </div>

                {/* Panel count */}
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", marginBottom: "6px", color: "#1A1A1A" }}>
                    Panels per comic ({options.panels})
                  </label>
                  <input
                    type="range" min={4} max={16} step={2}
                    value={options.panels}
                    onChange={(e) => setOptions({ ...options, panels: Number(e.target.value) })}
                    data-testid="panel-count-slider"
                    style={{ width: "100%", accentColor: "#CBB2FE" }}
                  />
                  <p style={{ margin: "8px 0 0", fontSize: "12px", fontWeight: 600, color: "#666", lineHeight: 1.4 }}>
                    {usage && !usage.is_premium
                      ? <>Free plan comics use standard AI art, which can vary panel to panel. <a href="/pricing" style={{ color: "#1A1A1A", fontWeight: 800 }}>Upgrade to Pro or Team</a> for premium art on every one of your {options.panels} panels, every time.</>
                      : <>Your plan renders every one of these {options.panels} panels in premium, consistent art quality.</>}
                  </p>
                </div>

                {/* Language */}
                <div>
                  <label style={{ display: "block", fontWeight: 700, fontSize: "13px", marginBottom: "6px", color: "#1A1A1A" }}>
                    Output language
                  </label>
                  <select
                    value={options.language}
                    onChange={(e) => setOptions({ ...options, language: e.target.value })}
                    data-testid="language-select"
                    style={{
                      width: "100%", padding: "9px 12px",
                      border: "2px solid #1A1A1A", borderRadius: "8px",
                      fontFamily: "'Nunito', sans-serif", fontWeight: 600,
                      fontSize: "14px", background: "#FFFDF8",
                    }}
                  >
                    <option value="en">English</option>
                    <option value="hi">Hindi</option>
                    <option value="es">Spanish</option>
                    <option value="zh">Chinese</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>
              </div>
            )}

            {/* Convert button */}
            <button
              onClick={convert}
              disabled={!file}
              data-testid="convert-btn"
              style={{
                marginTop: "28px", width: "100%",
                padding: "18px 24px",
                background: file ? "#CBB2FE" : "#E5E5E5",
                border: "2.5px solid #1A1A1A",
                borderRadius: "14px",
                boxShadow: file ? "5px 5px 0 #1A1A1A" : "none",
                fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                fontSize: "18px", color: "#1A1A1A",
                cursor: file ? "pointer" : "not-allowed",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "10px",
                transition: "transform 0.1s, box-shadow 0.1s",
              }}
              onMouseDown={(e) => {
                if (file) { e.currentTarget.style.transform = "translate(3px,3px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A"; }
              }}
              onMouseUp={(e) => {
                if (file) { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "5px 5px 0 #1A1A1A"; }
              }}
            >
              <Zap size={22} strokeWidth={2.5} />
              Convert to Comic
              <ArrowRight size={20} strokeWidth={2.5} />
            </button>
          </>
        )}

        {/* ── CHOOSING TOPICS ── */}
        {stage === STAGES.CHOOSING_TOPICS && (
          <div style={{
            background: "#fff", border: "3px solid #1A1A1A",
            borderRadius: "20px", boxShadow: "6px 6px 0 #1A1A1A",
            padding: "32px",
          }}>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 6px" }}>
              We found {topics.length} major topics
            </h2>
            <p style={{ color: "#888", fontSize: "14px", fontWeight: 600, margin: "0 0 20px" }}>
              Pick which ones to turn into mini-comics. Each becomes its own comic in your library.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
              {topics.map((topic) => {
                const checked = selectedTopicIds.includes(topic.topic_id);
                return (
                  <label
                    key={topic.topic_id}
                    data-testid={`topic-option-${topic.topic_id}`}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "12px",
                      padding: "14px 16px",
                      border: `2.5px solid ${checked ? "#1A1A1A" : "#E5E5E5"}`,
                      borderRadius: "12px",
                      background: checked ? "#FFFDF8" : "#fff",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTopic(topic.topic_id)}
                      style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#CBB2FE", flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "15px", color: "#1A1A1A" }}>
                        {topic.title}
                      </div>
                      <div style={{ fontSize: "13px", color: "#777", fontWeight: 600, marginTop: "2px" }}>
                        {topic.summary}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={generateSelectedTopics}
                disabled={selectedTopicIds.length === 0}
                data-testid="generate-selected-topics-btn"
                style={{
                  flex: 1, padding: "16px",
                  background: selectedTopicIds.length ? "#CBB2FE" : "#E5E5E5",
                  border: "2.5px solid #1A1A1A", borderRadius: "12px",
                  boxShadow: selectedTopicIds.length ? "4px 4px 0 #1A1A1A" : "none",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "16px",
                  color: "#1A1A1A", cursor: selectedTopicIds.length ? "pointer" : "not-allowed",
                }}
              >
                Generate {selectedTopicIds.length} comic{selectedTopicIds.length === 1 ? "" : "s"}
              </button>
              <button
                onClick={reset}
                style={{
                  padding: "16px 20px",
                  background: "#fff", border: "2.5px solid #1A1A1A", borderRadius: "12px",
                  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "14px",
                  color: "#555", cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── PROCESSING ── */}
        {isProcessing && (
          <div style={{
            background: "#fff", border: "3px solid #1A1A1A",
            borderRadius: "20px", boxShadow: "6px 6px 0 #1A1A1A",
            padding: "48px 32px", textAlign: "center",
            animation: "popIn 0.4s ease",
          }}>
            {/* Animated spinner */}
            <div style={{
              width: "80px", height: "80px",
              background: "#FFB5E8", border: "3px solid #1A1A1A",
              borderRadius: "20px", boxShadow: "4px 4px 0 #1A1A1A",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 24px",
              animation: "spin 1.4s cubic-bezier(0.65,0,0.35,1) infinite, pulse 1.4s ease-in-out infinite",
            }}>
              <Zap size={38} color="#1A1A1A" strokeWidth={2} />
            </div>
            <style>{`
              @keyframes spin { 0%{transform:rotate(0deg) scale(1)} 50%{transform:rotate(180deg) scale(1.08)} 100%{transform:rotate(360deg) scale(1)} }
              @keyframes pulse { 0%,100%{box-shadow:4px 4px 0 #1A1A1A} 50%{box-shadow:6px 6px 0 #1A1A1A} }
            `}</style>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontWeight: 800,
              fontSize: "24px", color: "#1A1A1A", margin: "0 0 8px",
            }}>
              {stage === STAGES.OUTLINING
                ? "Finding the major topics…"
                : stage === STAGES.SCRIPTING
                  ? "Writing your comic script…"
                  : stage === STAGES.ILLUSTRATING
                    ? "Painting the panels…"
                    : "Reading your PDF…"}
            </h2>
            <p style={{ color: "#888", fontSize: "15px", fontWeight: 600, margin: "0 0 24px" }}>
              {stage === STAGES.OUTLINING
                ? "PaperComic is scanning the document structure."
                : stage === STAGES.SCRIPTING
                  ? "PaperComic Flash is analyzing the content and building a storyboard."
                  : stage === STAGES.ILLUSTRATING
                    ? "Generating each panel image."
                    : "Extracting text and structure from your PDF."}
            </p>
            <ProgressBar stage={stage} />
          </div>
        )}

        {/* ── DONE ── */}
        {stage === STAGES.DONE && (
          <>
            <style>{`
              @keyframes popIn { 0% { opacity:0; transform: scale(0.9) translateY(-6px); } 100% { opacity:1; transform: scale(1) translateY(0); } }
              @keyframes panelIn { from { opacity:0; transform: translateY(14px) scale(0.96); } to { opacity:1; transform: translateY(0) scale(1); } }
            `}</style>
            {/* Success header */}
            <div style={{
              background: "#A0E8AF", border: "3px solid #1A1A1A",
              borderRadius: "16px", boxShadow: "5px 5px 0 #1A1A1A",
              padding: "20px 24px", marginBottom: completedComics.length > 1 ? "16px" : "28px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: "12px",
              animation: "popIn 0.45s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <div>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 4px" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}><CheckCircle2 size={20} color="#1A1A1A" strokeWidth={2} /> {completedComics.length > 1 ? `${completedComics.length} mini-comics ready!` : "Your comic is ready!"}</span>
                </h2>
                <p style={{ margin: 0, fontSize: "14px", color: "#333", fontWeight: 600 }}>
                  {completedComics.length > 1
                    ? `Generated from ${file?.name}, split by topic`
                    : `${panels.length} panels generated from ${file?.name}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <a
                  href={comicId ? `/reader/${comicId}` : "#"}
                  data-testid="read-comic-btn"
                  style={{
                    padding: "10px 18px",
                    background: "#CBB2FE", border: "2.5px solid #1A1A1A",
                    borderRadius: "10px", boxShadow: "3px 3px 0 #1A1A1A",
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                    fontSize: "14px", color: "#1A1A1A",
                    textDecoration: "none",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  Read full comic <ArrowRight size={16} />
                </a>
                <button
                  onClick={reset}
                  data-testid="convert-another-btn"
                  style={{
                    padding: "10px 18px",
                    background: "#FFFDF8", border: "2.5px solid #1A1A1A",
                    borderRadius: "10px", boxShadow: "3px 3px 0 #1A1A1A",
                    fontFamily: "'Nunito', sans-serif", fontWeight: 700,
                    fontSize: "14px", color: "#555",
                    cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "6px",
                  }}
                >
                  <RotateCcw size={14} /> Convert another
                </button>
              </div>
            </div>

            {/* Chapter switcher (only when multiple topic-comics were generated) */}
            {completedComics.length > 1 && (
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "24px" }}>
                {completedComics.map((c) => (
                  <button
                    key={c.comic_id}
                    onClick={() => { setPanels(c.panels); setComicId(c.comic_id); }}
                    data-testid={`chapter-tab-${c.comic_id}`}
                    style={{
                      padding: "8px 14px",
                      background: c.comic_id === comicId ? "#1A1A1A" : "#fff",
                      color: c.comic_id === comicId ? "#fff" : "#1A1A1A",
                      border: "2px solid #1A1A1A", borderRadius: "20px",
                      fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "13px",
                      cursor: "pointer",
                    }}
                  >
                    {c.topic_title}
                  </button>
                ))}
              </div>
            )}

            {/* Panel grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: "20px",
            }}>
              {panels.map((panel, i) => (
                <PanelCard key={i} panel={panel} index={i} />
              ))}
            </div>
          </>
        )}
      </main>

      {showUpgradeModal && (
        <UpgradeModal
          usage={usage}
          onClose={() => setShowUpgradeModal(false)}
        />
      )}
    </div>
  );
}

// ── Upgrade modal ───────────────────────────────────────────────────────────
function UpgradeModal({ usage, onClose }) {
  return (
    <div
      data-testid="upgrade-modal-overlay"
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(26,26,26,0.55)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", border: "3px solid #1A1A1A",
          borderRadius: "20px", boxShadow: "6px 6px 0 #1A1A1A",
          padding: "32px", maxWidth: "420px", width: "100%",
          textAlign: "center",
        }}
      >
        <div style={{
          width: "64px", height: "64px", margin: "0 auto 16px",
          background: "#FBEA8C", border: "3px solid #1A1A1A",
          borderRadius: "50%", display: "flex",
          alignItems: "center", justifyContent: "center",
        }}>
          <Sparkles size={30} color="#1A1A1A" />
        </div>
        <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 8px" }}>
          You've used your free comics!
        </h2>
        <p style={{ color: "#666", fontSize: "14px", fontWeight: 600, margin: "0 0 24px" }}>
          {usage
            ? `You've generated ${usage.free_generations_used} of ${usage.free_generation_limit} free comics. Upgrade for unlimited comics and higher-quality art.`
            : "Upgrade for unlimited comics and higher-quality art."}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <a
            href="/pricing"
            data-testid="upgrade-modal-cta"
            style={{
              flex: 1, padding: "14px",
              background: "#CBB2FE", border: "2.5px solid #1A1A1A", borderRadius: "12px",
              boxShadow: "4px 4px 0 #1A1A1A",
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "15px",
              color: "#1A1A1A", textDecoration: "none",
            }}
          >
            See plans
          </a>
          <button
            onClick={onClose}
            data-testid="upgrade-modal-dismiss"
            style={{
              padding: "14px 20px",
              background: "#fff", border: "2.5px solid #1A1A1A", borderRadius: "12px",
              fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "14px",
              color: "#555", cursor: "pointer",
            }}
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}