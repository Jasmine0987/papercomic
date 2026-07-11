import { useState } from "react";
import { Eye, EyeOff, BookOpen, Sparkles, ArrowRight } from "lucide-react";

// ── Inline SVG doodles (consistent with Landing Doodles.jsx) ──────────────
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

// ── Google Icon ────────────────────────────────────────────────────────────
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

export default function SignIn({ onNavigate }) {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "" });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      setError("Please fill in all fields.");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch("https://papercomic-api.onrender.com/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Login error:", data);
        throw new Error(data.detail || data.message || JSON.stringify(data));
      }
      localStorage.setItem("pc_token", data.access_token);
      // navigate to upload/dashboard
      if (onNavigate) onNavigate("/upload");
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
      <Star size={32} color="#FFB5E8" style={{ position: "absolute", top: "8%", left: "6%", opacity: 0.7, transform: "rotate(-15deg)" }} />
      <Star size={20} color="#CBB2FE" style={{ position: "absolute", top: "20%", right: "8%", opacity: 0.6 }} />
      <Squiggle color="#A0E8AF" style={{ position: "absolute", bottom: "15%", left: "4%", opacity: 0.5 }} />
      <Zigzag color="#FBEA8C" style={{ position: "absolute", top: "70%", right: "5%", opacity: 0.6 }} />
      <Star size={16} color="#FBEA8C" style={{ position: "absolute", bottom: "30%", left: "12%", opacity: 0.5 }} />
      <Squiggle color="#FFB5E8" style={{ position: "absolute", top: "5%", right: "20%", opacity: 0.4 }} />

      {/* Logo */}
      <a
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "36px",
          textDecoration: "none",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            background: "#FFB5E8",
            border: "2.5px solid #1A1A1A",
            borderRadius: "10px",
            boxShadow: "3px 3px 0 #1A1A1A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BookOpen size={20} color="#1A1A1A" strokeWidth={2.5} />
        </div>
        <span
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: "22px",
            color: "#1A1A1A",
            letterSpacing: "-0.5px",
          }}
        >
          PaperComic
        </span>
      </a>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#fff",
          border: "3px solid #1A1A1A",
          borderRadius: "20px",
          boxShadow: "6px 6px 0 #1A1A1A",
          padding: "36px 32px",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Sparkles size={20} color="#CBB2FE" />
            <span
              style={{
                fontFamily: "'Caveat', cursive",
                fontSize: "15px",
                color: "#888",
                fontWeight: 600,
              }}
            >
              welcome back
            </span>
          </div>
          <h1
            style={{
              fontFamily: "'Outfit', sans-serif",
              fontWeight: 800,
              fontSize: "28px",
              color: "#1A1A1A",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Sign in to your account
          </h1>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogle}
          data-testid="google-signin-btn"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "12px",
            background: "#FFFDF8",
            border: "2.5px solid #1A1A1A",
            borderRadius: "12px",
            boxShadow: "3px 3px 0 #1A1A1A",
            fontSize: "15px",
            fontWeight: 700,
            fontFamily: "'Nunito', sans-serif",
            color: "#1A1A1A",
            cursor: "pointer",
            marginBottom: "20px",
            transition: "transform 0.1s, box-shadow 0.1s",
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = "translate(2px,2px)";
            e.currentTarget.style.boxShadow = "1px 1px 0 #1A1A1A";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "";
            e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A";
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <div style={{ flex: 1, height: "2px", background: "#E5E5E5" }} />
          <span style={{ fontSize: "13px", color: "#999", fontWeight: 600 }}>or</span>
          <div style={{ flex: 1, height: "2px", background: "#E5E5E5" }} />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: "14px",
                color: "#1A1A1A",
                marginBottom: "6px",
              }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={form.email}
              onChange={handleChange}
              data-testid="email-input"
              style={{
                width: "100%",
                padding: "12px 14px",
                border: "2.5px solid #1A1A1A",
                borderRadius: "10px",
                fontSize: "15px",
                fontFamily: "'Nunito', sans-serif",
                background: "#FFFDF8",
                outline: "none",
                boxSizing: "border-box",
                transition: "box-shadow 0.15s",
              }}
              onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
              onBlur={(e) => (e.target.style.boxShadow = "none")}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "8px" }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                fontWeight: 700,
                fontSize: "14px",
                color: "#1A1A1A",
                marginBottom: "6px",
              }}
            >
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                data-testid="password-input"
                style={{
                  width: "100%",
                  padding: "12px 44px 12px 14px",
                  border: "2.5px solid #1A1A1A",
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontFamily: "'Nunito', sans-serif",
                  background: "#FFFDF8",
                  outline: "none",
                  boxSizing: "border-box",
                  transition: "box-shadow 0.15s",
                }}
                onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
                onBlur={(e) => (e.target.style.boxShadow = "none")}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px",
                  color: "#888",
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: "20px" }}>
            <a
              href="/forgot-password"
              style={{
                fontSize: "13px",
                color: "#CBB2FE",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Forgot password?
            </a>
          </div>

          {/* Error */}
          {error && (
            <div
              data-testid="error-msg"
              style={{
                background: "#FFE4E4",
                border: "2px solid #FF6B6B",
                borderRadius: "8px",
                padding: "10px 14px",
                fontSize: "13px",
                color: "#CC0000",
                fontWeight: 600,
                marginBottom: "16px",
              }}
            >
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            data-testid="signin-submit-btn"
            style={{
              width: "100%",
              padding: "14px",
              background: isLoading ? "#ccc" : "#CBB2FE",
              border: "2.5px solid #1A1A1A",
              borderRadius: "12px",
              boxShadow: isLoading ? "none" : "4px 4px 0 #1A1A1A",
              fontSize: "16px",
              fontWeight: 800,
              fontFamily: "'Outfit', sans-serif",
              color: "#1A1A1A",
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = "translate(2px,2px)";
                e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A";
              }
            }}
            onMouseUp={(e) => {
              if (!isLoading) {
                e.currentTarget.style.transform = "";
                e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A";
              }
            }}
          >
            {isLoading ? "Signing in…" : (
              <>Sign in <ArrowRight size={18} strokeWidth={2.5} /></>
            )}
          </button>
        </form>

        {/* Sign up link */}
        <p
          style={{
            textAlign: "center",
            marginTop: "24px",
            fontSize: "14px",
            color: "#666",
            margin: "24px 0 0",
          }}
        >
          No account yet?{" "}
          <a
            href="/signup"
            data-testid="go-signup-link"
            style={{
              color: "#1A1A1A",
              fontWeight: 800,
              textDecoration: "underline",
              textUnderlineOffset: "3px",
            }}
          >
            Create one free →
          </a>
        </p>
      </div>

      {/* Terms */}
      <p style={{ marginTop: "20px", fontSize: "12px", color: "#aaa", textAlign: "center" }}>
        By signing in you agree to our{" "}
        <a href="/terms" style={{ color: "#888", textDecoration: "underline" }}>Terms</a>{" "}
        and{" "}
        <a href="/privacy" style={{ color: "#888", textDecoration: "underline" }}>Privacy Policy</a>.
      </p>
    </div>
  );
}