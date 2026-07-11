import { useState, useEffect, useRef } from "react";
import { BookOpen, LogOut, Zap, User } from "lucide-react";

export default function TopNav({ user: userProp, usage: usageProp }) {
  const [user, setUser] = useState(userProp || null);
  const [usage, setUsage] = useState(usageProp || null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (userProp && usageProp) return;
    const token = localStorage.getItem("pc_token");
    if (!token) return;
    fetch(`${process.env.REACT_APP_API_BASE}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          if (!userProp) setUser({ name: data.name, email: data.email, id: data.id });
          if (!usageProp) setUsage(data);
        }
      })
      .catch(() => {});
  }, [userProp, usageProp]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = () => {
    localStorage.removeItem("pc_token");
    window.location.href = "/signin";
  };

  const isLoggedIn = !!user;
  const isPaid = usage?.plan && usage.plan !== "free";
  const currentPath = typeof window !== "undefined" ? window.location.pathname : "";

  const linkStyle = (path) => ({
    fontFamily: "'Nunito', sans-serif",
    fontWeight: 700,
    fontSize: "14px",
    color: currentPath === path ? "#1A1A1A" : "#555",
    textDecoration: "none",
    borderBottom: currentPath === path ? "2px solid #CBB2FE" : "2px solid transparent",
    paddingBottom: "2px",
  });

  return (
    <nav style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "#FFFDF8", borderBottom: "2.5px solid #1A1A1A",
      padding: "0 24px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      height: "60px",
    }}>
      {/* Logo */}
      <a href="/mf.html" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
        <div style={{
          width: "34px", height: "34px", background: "#FFB5E8",
          border: "2.5px solid #1A1A1A", borderRadius: "8px",
          boxShadow: "2px 2px 0 #1A1A1A",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <BookOpen size={17} color="#1A1A1A" strokeWidth={2.5} />
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "18px", color: "#1A1A1A" }}>
          PaperComic
        </span>
      </a>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        {/* Usage badge */}
        {isLoggedIn && usage && !isPaid && (
          <a href="/pricing" data-testid="usage-badge-link" style={{
            display: "flex", alignItems: "center", gap: "6px",
            padding: "5px 12px",
            background: usage.free_generations_used >= usage.free_generation_limit ? "#FFE4E4" : "#FFFDF8",
            border: "1.5px solid #1A1A1A", borderRadius: "20px",
            fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "12px",
            color: "#1A1A1A", textDecoration: "none",
          }}>
            {usage.free_generation_limit - usage.free_generations_used > 0
              ? `${usage.free_generation_limit - usage.free_generations_used} free left`
              : "⚡ Upgrade"}
          </a>
        )}
        {isLoggedIn && isPaid && (
          <span style={{
            padding: "5px 12px", background: "#A0E8AF",
            border: "1.5px solid #1A1A1A", borderRadius: "20px",
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: "12px",
            textTransform: "capitalize",
          }}>
            {usage.plan} plan
          </span>
        )}

        {/* Nav links */}
        {isLoggedIn && <a href="/upload" data-testid="nav-upload-link" style={linkStyle("/upload")}>Upload</a>}
        {isLoggedIn && <a href="/library" data-testid="nav-library-link" style={linkStyle("/library")}>My Library</a>}
        <a href="/pricing" data-testid="nav-pricing-link" style={linkStyle("/pricing")}>Pricing</a>
        <a href="/about" data-testid="nav-about-link" style={linkStyle("/about")}>About</a>

        {/* Avatar / dropdown trigger */}
        {isLoggedIn ? (
          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              data-testid="account-avatar-btn"
              style={{
                width: "34px", height: "34px", background: "#CBB2FE",
                border: "2px solid #1A1A1A", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "14px",
                cursor: "pointer", boxShadow: dropdownOpen ? "0px 0px 0 #1A1A1A" : "2px 2px 0 #1A1A1A",
                transform: dropdownOpen ? "translate(2px, 2px)" : "none",
                transition: "transform 0.1s, box-shadow 0.1s",
                color: "#1A1A1A",
              }}
              title={user?.email}
            >
              {user?.name?.[0]?.toUpperCase() || "U"}
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div
                data-testid="account-dropdown"
                style={{
                  position: "absolute", top: "calc(100% + 10px)", right: 0,
                  background: "#fff", border: "2.5px solid #1A1A1A",
                  borderRadius: "14px", boxShadow: "5px 5px 0 #1A1A1A",
                  minWidth: "200px", overflow: "hidden", zIndex: 200,
                }}
              >
                {/* User info header */}
                <div style={{
                  padding: "14px 16px",
                  borderBottom: "2px solid #E5E5E5",
                  background: "#FFFDF8",
                }}>
                  <div style={{
                    fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                    fontSize: "14px", color: "#1A1A1A",
                  }}>
                    {user?.name}
                  </div>
                  <div style={{ fontSize: "12px", color: "#888", fontWeight: 600, marginTop: "2px" }}>
                    {user?.email}
                  </div>
                  {usage && (
                    <div style={{
                      marginTop: "8px", display: "inline-block",
                      padding: "3px 10px",
                      background: isPaid ? "#A0E8AF" : "#FBEA8C",
                      border: "1.5px solid #1A1A1A", borderRadius: "20px",
                      fontSize: "11px", fontWeight: 800,
                      textTransform: "capitalize",
                    }}>
                      {isPaid ? `${usage.plan} plan` : `Free · ${usage.free_generation_limit - usage.free_generations_used} left`}
                    </div>
                  )}
                </div>

                {/* Menu items */}
                <div style={{ padding: "8px" }}>
                  {/* Upgrade — only show for free users */}
                  {!isPaid && (
                    <a
                      href="/pricing"
                      data-testid="dropdown-upgrade-link"
                      onClick={() => setDropdownOpen(false)}
                      style={{
                        display: "flex", alignItems: "center", gap: "10px",
                        padding: "10px 12px", borderRadius: "8px",
                        textDecoration: "none", color: "#1A1A1A",
                        fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "14px",
                        background: "#CBB2FE", border: "1.5px solid #1A1A1A",
                        marginBottom: "6px",
                        boxShadow: "2px 2px 0 #1A1A1A",
                      }}
                    >
                      <Zap size={15} strokeWidth={2.5} />
                      Upgrade plan
                    </a>
                  )}

                  {/* Profile/account — placeholder for future */}
                  <a
                    href="/upload"
                    data-testid="dropdown-upload-link"
                    onClick={() => setDropdownOpen(false)}
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "10px 12px", borderRadius: "8px",
                      textDecoration: "none", color: "#444",
                      fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "14px",
                      marginBottom: "2px",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F5F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <User size={15} strokeWidth={2} />
                    Go to Upload
                  </a>

                  {/* Log out */}
                  <button
                    onClick={handleLogout}
                    data-testid="dropdown-logout-btn"
                    style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      width: "100%", padding: "10px 12px", borderRadius: "8px",
                      background: "none", border: "none",
                      fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: "14px",
                      color: "#CC0000", cursor: "pointer", textAlign: "left",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#FFE4E4")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    <LogOut size={15} strokeWidth={2} />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <a href="/signup" data-testid="nav-signup-cta" style={{
            padding: "8px 16px", background: "#CBB2FE",
            border: "2px solid #1A1A1A", borderRadius: "8px",
            boxShadow: "2px 2px 0 #1A1A1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "13px",
            color: "#1A1A1A", textDecoration: "none",
          }}>Try free</a>
        )}
      </div>
    </nav>
  );
}