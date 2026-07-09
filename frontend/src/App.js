/**
 * App.js — PaperComic
 * Landing page (/) → served from public/mf.html (static)
 * All other routes → React JSX pages
 */

import { useState, useEffect, useRef } from "react";

import SignIn      from "./pages/auth/SignIn";
import SignUp      from "./pages/auth/SignUp";
import UploadPage  from "./pages/upload/UploadPage";
import LibraryPage from "./pages/library/LibraryPage";
import ReaderPage  from "./pages/reader/ReaderPage";
import PricingPage from "./pages/pricing/PricingPage";
import AboutPage   from "./pages/about/AboutPage";
import OAuthCallback from "./pages/auth/OAuthCallback";

// ── Router ──────────────────────────────────────────────────────────────────
function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return path;
}

export function navigate(to) {
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

// ── Auth ────────────────────────────────────────────────────────────────────
function getUser() {
  const token = localStorage.getItem("pc_token");
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem("pc_token");
      return null;
    }
    return { id: payload.sub, name: payload.name, email: payload.email };
  } catch {
    return null;
  }
}

function Protected({ children }) {
  const user = getUser();
  useEffect(() => {
    if (!user) navigate("/signin");
  }, [user]);
  if (!user) return null;
  return children;
}

// ── Route matcher ───────────────────────────────────────────────────────────
function matchRoute(pattern, actual) {
  const pp = pattern.split("/").filter(Boolean);
  const ap = actual.split("/").filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    else if (pp[i] !== ap[i]) return null;
  }
  return params;
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const path = usePath();

  // Pick up ?token= from Google OAuth redirect — this MUST happen
  // synchronously during render, before any child (e.g. <Protected>)
  // gets a chance to check auth state. If this were a useEffect here
  // instead, it would fire *after* Protected's own effect (children's
  // effects run before their parent's), so Protected would see "no
  // user yet", redirect to /signin, and wipe the ?token from the URL
  // before this code ever got to read it.
  const didConsumeToken = useRef(false);
  if (!didConsumeToken.current) {
    didConsumeToken.current = true;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      localStorage.setItem("pc_token", token);
      window.history.replaceState({}, "", "/upload");
    }
  }

  const user = getUser();

  // "/" → hand off to the static mf.html landing page
  if (path === "/" || path === "/index.html") {
    window.location.href = "/mf.html";
    return null;
  }

  const routes = [
    { pattern: "/signin",      el: () => <SignIn  onNavigate={navigate} /> },
    { pattern: "/signup",      el: () => <SignUp  onNavigate={navigate} /> },
    { pattern: "/pricing",     el: () => <PricingPage /> },
    { pattern: "/about",       el: () => <AboutPage /> },
    { pattern: "/auth/callback", el: () => <OAuthCallback onNavigate={navigate} /> },
    {
      pattern: "/upload",
      el: () => (
        <Protected>
          <UploadPage user={user} onNavigate={navigate} />
        </Protected>
      ),
    },
    {
      pattern: "/library",
      el: () => (
        <Protected>
          <LibraryPage user={user} onNavigate={navigate} />
        </Protected>
      ),
    },
    {
      pattern: "/reader/:id",
      el: (params) => (
        <Protected>
          <ReaderPage comicId={params.id} user={user} onNavigate={navigate} />
        </Protected>
      ),
    },
  ];

  for (const route of routes) {
    const params = matchRoute(route.pattern, path);
    if (params !== null) return route.el(params);
  }

  // 404
  return (
    <div style={{
      minHeight: "100vh", background: "#FFFDF8",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'Nunito', sans-serif", textAlign: "center", padding: "24px",
    }}>
      <div style={{ fontSize: "64px", marginBottom: "16px" }}>🗺️</div>
      <h1 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "42px", color: "#1A1A1A", margin: "0 0 8px" }}>
        404
      </h1>
      <p style={{ color: "#666", fontSize: "16px", fontWeight: 600, marginBottom: "24px" }}>
        This page doesn't exist.
      </p>
      <a href="/mf.html" style={{
        padding: "12px 24px", background: "#CBB2FE",
        border: "2.5px solid #1A1A1A", borderRadius: "12px",
        boxShadow: "4px 4px 0 #1A1A1A",
        fontFamily: "'Outfit', sans-serif", fontWeight: 800,
        fontSize: "15px", color: "#1A1A1A", textDecoration: "none",
      }}>
        ← Back to home
      </a>
    </div>
  );
}