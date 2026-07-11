import { useState } from "react";
import { Eye, EyeOff, BookOpen, Sparkles, ArrowRight, Check } from "lucide-react";

function Star({ size = 24, color = "#FFB5E8", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}
function Squiggle({ color = "#A0E8AF", style }) {
  return (
    <svg width="60" height="20" viewBox="0 0 60 20" fill="none" style={style}>
      <path d="M2 10 Q10 2 18 10 Q26 18 34 10 Q42 2 50 10 Q54 14 58 10" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}
function Zigzag({ color = "#FBEA8C", style }) {
  return (
    <svg width="50" height="16" viewBox="0 0 50 16" fill="none" style={style}>
      <polyline points="0,12 10,4 20,12 30,4 40,12 50,4" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.4 35.5 26.8 36.5 24 36.5c-5.3 0-9.8-3.5-11.3-8.3l-6.5 5C9.8 40 16.4 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.3 4.1-4.3 5.4l6.2 5.2C40.7 35.6 44 30.3 44 24c0-1.3-.1-2.6-.4-3.9z"/>
    </svg>
  );
}

const PERKS = [
  "Convert unlimited PDFs to comic strips",
  "Save & organize your comic library",
  "Share comics with your study group",
];

function validatePassword(pw) {
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasDigit = /[0-9]/.test(pw);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(pw);
  return pw.length >= 12 && hasUpper && hasLower && hasDigit && hasSpecial;
}

export default function SignUp({ onNavigate }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (!validatePassword(form.password)) {
      setError("Password must be 12+ chars with uppercase, lowercase, number, and special character (!@#$%^&*)");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("https://papercomic-api.onrender.com/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Registration error:", data);
        throw new Error(data.detail || data.message || JSON.stringify(data));
      }
      localStorage.setItem("pc_token", data.access_token);
      setSuccess(true);
      setTimeout(() => { if (onNavigate) onNavigate("/upload"); }, 1200);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      const API_BASE = "https://papercomic-api.onrender.com";
    
      // Get state from backend
      const res = await fetch(`${API_BASE}/api/auth/google/start`, {
        method: "POST",
        credentials: "include",
      });
      const { state } = await res.json();
    
      // Build Google OAuth URL
      const params = new URLSearchParams({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        redirect_uri: `${window.location.origin}/auth/callback`,
        response_type: "code",
        scope: "openid email profile",
        state: state,
        access_type: "offline",
        prompt: "consent",
      });
    
      window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } catch (err) {
      console.error("OAuth start failed:", err);
      alert("Failed to start Google login");
    }
  };

  if (success) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#FFFDF8",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{
          textAlign: "center",
          background: "#A0E8AF",
          border: "3px solid #1A1A1A",
          borderRadius: "20px",
          boxShadow: "6px 6px 0 #1A1A1A",
          padding: "48px 40px",
        }}>
          <div style={{
            width: "64px", height: "64px",
            background: "#fff",
            border: "3px solid #1A1A1A",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            boxShadow: "3px 3px 0 #1A1A1A",
          }}>
            <Check size={32} color="#1A1A1A" strokeWidth={3} />
          </div>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "24px", margin: "0 0 8px" }}>
            You're in! 🎉
          </h2>
          <p style={{ color: "#333", margin: 0 }}>Heading to your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFFDF8",
        fontFamily: "'Nunito', sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background doodles */}
      <Star size={28} color="#FBEA8C" style={{ position: "absolute", top: "6%", left: "8%", opacity: 0.7, transform: "rotate(20deg)" }} />
      <Star size={18} color="#FFB5E8" style={{ position: "absolute", top: "25%", right: "6%", opacity: 0.6 }} />
      <Squiggle color="#CBB2FE" style={{ position: "absolute", bottom: "12%", left: "5%", opacity: 0.5 }} />
      <Zigzag color="#A0E8AF" style={{ position: "absolute", top: "68%", right: "4%", opacity: 0.6 }} />
      <Star size={14} color="#A0E8AF" style={{ position: "absolute", bottom: "28%", left: "15%", opacity: 0.5 }} />

      {/* Logo */}
      <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "36px", textDecoration: "none" }}>
        <div style={{
          width: "40px", height: "40px",
          background: "#FFB5E8",
          border: "2.5px solid #1A1A1A",
          borderRadius: "10px",
          boxShadow: "3px 3px 0 #1A1A1A",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BookOpen size={20} color="#1A1A1A" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", color: "#1A1A1A", letterSpacing: "-0.5px" }}>
          PaperComic
        </span>
      </a>

      <div style={{ display: "flex", gap: "24px", width: "100%", maxWidth: "860px", alignItems: "flex-start" }}>

        {/* Left perk panel — hidden on narrow viewports via inline media is not possible so we just render it */}
        <div style={{
          flex: "0 0 260px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          paddingTop: "8px",
        }}
          className="signup-perks"
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
              <Sparkles size={18} color="#FBEA8C" />
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: "15px", color: "#888", fontWeight: 600 }}>free forever</span>
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "26px", color: "#1A1A1A", margin: 0, lineHeight: 1.2 }}>
              Turn dense papers into comics you'll actually read.
            </h2>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
            {PERKS.map((perk, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                <div style={{
                  width: "24px", height: "24px", flexShrink: 0,
                  background: ["#FFB5E8", "#A0E8AF", "#CBB2FE"][i],
                  border: "2px solid #1A1A1A",
                  borderRadius: "6px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Check size={14} color="#1A1A1A" strokeWidth={3} />
                </div>
                <span style={{ fontSize: "14px", color: "#444", fontWeight: 600, lineHeight: 1.4 }}>{perk}</span>
              </div>
            ))}
          </div>

          {/* Mini PDF→Comic visual */}
          <div style={{
            marginTop: "16px",
            background: "#FBEA8C",
            border: "2.5px solid #1A1A1A",
            borderRadius: "14px",
            boxShadow: "4px 4px 0 #1A1A1A",
            padding: "16px",
          }}>
            <div style={{ fontFamily: "'Caveat', cursive", fontSize: "14px", color: "#555", marginBottom: "10px" }}>
              ✨ example conversion
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {/* Tiny PDF */}
              <div style={{
                flex: 1, background: "#fff",
                border: "2px solid #1A1A1A", borderRadius: "8px",
                padding: "8px", fontSize: "9px", color: "#666",
                lineHeight: 1.5,
              }}>
                <div style={{ fontWeight: 700, fontSize: "9px", marginBottom: "4px" }}>Abstract</div>
                <div style={{ background: "#E5E5E5", height: "4px", borderRadius: "2px", marginBottom: "3px" }} />
                <div style={{ background: "#E5E5E5", height: "4px", borderRadius: "2px", marginBottom: "3px", width: "80%" }} />
                <div style={{ background: "#E5E5E5", height: "4px", borderRadius: "2px", width: "90%" }} />
              </div>
              <div style={{ fontSize: "18px" }}>→</div>
              {/* Tiny comic */}
              <div style={{
                flex: 1, background: "#fff",
                border: "2px solid #1A1A1A", borderRadius: "8px",
                padding: "6px",
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "4px",
              }}>
                {[["#FFB5E8", "😮"], ["#A0E8AF", "💡"], ["#FBEA8C", "🔬"], ["#CBB2FE", "🎉"]].map(([bg, em], i) => (
                  <div key={i} style={{
                    background: bg, border: "1.5px solid #1A1A1A", borderRadius: "4px",
                    height: "28px", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "14px",
                  }}>{em}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          flex: 1,
          background: "#fff",
          border: "3px solid #1A1A1A",
          borderRadius: "20px",
          boxShadow: "6px 6px 0 #1A1A1A",
          padding: "36px 32px",
        }}>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800, fontSize: "26px", color: "#1A1A1A",
            margin: "0 0 24px",
          }}>
            Create your account
          </h1>

          {/* Google */}
          <button
            onClick={handleGoogle}
            data-testid="google-signup-btn"
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
              gap: "10px", padding: "12px",
              background: "#FFFDF8", border: "2.5px solid #1A1A1A", borderRadius: "12px",
              boxShadow: "3px 3px 0 #1A1A1A",
              fontSize: "15px", fontWeight: 700, fontFamily: "'Nunito', sans-serif",
              color: "#1A1A1A", cursor: "pointer", marginBottom: "20px",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = "1px 1px 0 #1A1A1A"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A"; }}
          >
            <GoogleIcon /> Sign up with Google
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{ flex: 1, height: "2px", background: "#E5E5E5" }} />
            <span style={{ fontSize: "13px", color: "#999", fontWeight: 600 }}>or</span>
            <div style={{ flex: 1, height: "2px", background: "#E5E5E5" }} />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            {/* Name */}
            <div style={{ marginBottom: "14px" }}>
              <label htmlFor="name" style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
                Full name
              </label>
              <input
                id="name" name="name" type="text" autoComplete="name"
                placeholder="Alex Researcher"
                value={form.name} onChange={handleChange}
                data-testid="name-input"
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "2.5px solid #1A1A1A", borderRadius: "10px",
                  fontSize: "15px", fontFamily: "'Nunito', sans-serif",
                  background: "#FFFDF8", outline: "none", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #A0E8AF")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Email */}
            <div style={{ marginBottom: "14px" }}>
              <label htmlFor="email" style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
                Email
              </label>
              <input
                id="email" name="email" type="email" autoComplete="email"
                placeholder="you@university.edu"
                value={form.email} onChange={handleChange}
                data-testid="email-input"
                style={{
                  width: "100%", padding: "12px 14px",
                  border: "2.5px solid #1A1A1A", borderRadius: "10px",
                  fontSize: "15px", fontFamily: "'Nunito', sans-serif",
                  background: "#FFFDF8", outline: "none", boxSizing: "border-box",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #A0E8AF")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: "20px" }}>
              <label htmlFor="password" style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="password" name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password} onChange={handleChange}
                  data-testid="password-input"
                  style={{
                    width: "100%", padding: "12px 44px 12px 14px",
                    border: "2.5px solid #1A1A1A", borderRadius: "10px",
                    fontSize: "15px", fontFamily: "'Nunito', sans-serif",
                    background: "#FFFDF8", outline: "none", boxSizing: "border-box",
                  }}
                  onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #A0E8AF")}
                  onBlur={(e) => (e.target.style.boxShadow = "none")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: "absolute", right: "12px", top: "50%",
                    transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer",
                    padding: "4px", color: "#888",
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {/* Password strength hint */}
              {form.password && (
                <div style={{ marginTop: "6px", display: "flex", gap: "4px" }}>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} style={{
                      flex: 1, height: "4px", borderRadius: "2px",
                      background: form.password.length >= (i + 1) * 3
                        ? ["#FFB5E8", "#FBEA8C", "#A0E8AF"][i]
                        : "#E5E5E5",
                      transition: "background 0.2s",
                    }} />
                  ))}
                </div>
              )}
            </div>

            {error && (
              <div data-testid="error-msg" style={{
                background: "#FFE4E4", border: "2px solid #FF6B6B", borderRadius: "8px",
                padding: "10px 14px", fontSize: "13px", color: "#CC0000",
                fontWeight: 600, marginBottom: "16px",
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              data-testid="signup-submit-btn"
              style={{
                width: "100%", padding: "14px",
                background: isLoading ? "#ccc" : "#A0E8AF",
                border: "2.5px solid #1A1A1A", borderRadius: "12px",
                boxShadow: isLoading ? "none" : "4px 4px 0 #1A1A1A",
                fontSize: "16px", fontWeight: 800,
                fontFamily: "'Outfit', sans-serif",
                color: "#1A1A1A", cursor: isLoading ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: "8px",
              }}
              onMouseDown={(e) => {
                if (!isLoading) { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A"; }
              }}
              onMouseUp={(e) => {
                if (!isLoading) { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A"; }
              }}
            >
              {isLoading ? "Creating account…" : (
                <> Create free account <ArrowRight size={18} strokeWidth={2.5} /></>
              )}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "20px", fontSize: "14px", color: "#666" }}>
            Already have an account?{" "}
            <a href="/signin" data-testid="go-signin-link" style={{ color: "#1A1A1A", fontWeight: 800, textDecoration: "underline", textUnderlineOffset: "3px" }}>
              Sign in →
            </a>
          </p>
        </div>
      </div>

      <p style={{ marginTop: "20px", fontSize: "12px", color: "#aaa", textAlign: "center" }}>
        By creating an account you agree to our{" "}
        <a href="/terms" style={{ color: "#888", textDecoration: "underline" }}>Terms</a> and{" "}
        <a href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}