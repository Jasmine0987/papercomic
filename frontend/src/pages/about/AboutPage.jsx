import { useState } from "react";
import { BookOpen, Mail, Sparkles, ArrowRight, Heart, Palette, Zap, Lock, Clock, Inbox } from "lucide-react";

function GithubIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .5C5.7.5.7 5.5.7 11.9c0 5.1 3.3 9.4 7.9 11 .6.1.8-.3.8-.6v-2.2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.7-1.6-2.5-.3-5.2-1.3-5.2-5.6 0-1.2.4-2.2 1.2-3-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.8 1.2 1.8 1.2 3 0 4.3-2.7 5.3-5.2 5.6.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.6-1.6 7.9-5.9 7.9-11C23.3 5.5 18.3.5 12 .5z"/>
    </svg>
  );
}
import TopNav from "../../components/TopNav";


function Star({ size = 24, color = "#FFB5E8", style }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={style}>
      <polygon points="12,2 15,9 22,9 16,14 18,21 12,17 6,21 8,14 2,9 9,9" stroke="#1A1A1A" strokeWidth="1.5" />
    </svg>
  );
}
function Squiggle({ color = "#A0E8AF", style }) {
  return (
    <svg width="70" height="22" viewBox="0 0 70 22" fill="none" style={style}>
      <path d="M2 11 Q12 2 22 11 Q32 20 42 11 Q52 2 62 11 Q66 15 70 11" stroke={color} strokeWidth="3" strokeLinecap="round" fill="none" />
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

// ── Peep-style SVG avatar ──────────────────────────────────────────────────
function PeepAvatar({ bg = "#FFB5E8", initial = "Z", size = 64 }) {
  return (
    <div style={{
      width: size, height: size,
      background: bg, border: "2.5px solid #1A1A1A",
      borderRadius: "50%", boxShadow: "3px 3px 0 #1A1A1A",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Outfit', sans-serif", fontWeight: 900,
      fontSize: size * 0.38, color: "#1A1A1A",
      flexShrink: 0,
    }}>
      {initial}
    </div>
  );
}

const TEAM = [
  {
    name: "Jas",
    role: "Founder & Builder",
    bio: "Full-stack developer who got tired of reading 40-page papers at 2 AM. Built PaperComic so nobody else has to.",
    bg: "#CBB2FE",
    links: { github: "https://github.com/papercomic" },
  },
];

const VALUES = [
  {
    icon: <BookOpen size={24} color="#1A1A1A" strokeWidth={2} />,
    bg: "#FFB5E8",
    title: "Papers shouldn't be painful",
    body: "Research moves the world forward -but dense jargon and 80-page PDFs shouldn't be the bottleneck. We make knowledge accessible.",
  },
  {
    icon: <Palette size={24} color="#1A1A1A" strokeWidth={2} />,
    bg: "#A0E8AF",
    title: "Visuals stick",
    body: "Comics aren't toys. They're a proven memory medium. What takes 45 minutes to read takes 4 minutes to understand as a comic.",
  },
  {
    icon: <Zap size={24} color="#1A1A1A" strokeWidth={2} />,
    bg: "#FBEA8C",
    title: "Speed is respect",
    body: "Your time matters. Under 60 seconds from upload to finished comic -because waiting is the enemy of curiosity.",
  },
  {
    icon: <Lock size={24} color="#1A1A1A" strokeWidth={2} />,
    bg: "#CBB2FE",
    title: "Your research stays yours",
    body: "We don't train on your PDFs. We don't store them after conversion. Your work belongs to you, always.",
  },
];

function ContactForm() {
  const [form, setForm] = useState({ name: "", email: "", subject: "general", message: "" });
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errMsg, setErrMsg] = useState("");

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      setErrMsg("Please fill in all fields.");
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Send failed");
      setStatus("success");
    } catch {
      setErrMsg("Something went wrong. Email us directly at hello@papercomic.app");
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div style={{
        background: "#A0E8AF", border: "3px solid #1A1A1A",
        borderRadius: "16px", boxShadow: "5px 5px 0 #1A1A1A",
        padding: "40px 32px", textAlign: "center",
      }}>
        <div style={{ marginBottom: "12px" }}><Inbox size={40} color="#1A1A1A" strokeWidth={1.8} /></div>
        <h3 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "22px", margin: "0 0 8px" }}>
          Message sent!
        </h3>
        <p style={{ color: "#333", fontWeight: 600, margin: 0 }}>
          We'll get back to you within 24 hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        {/* Name */}
        <div>
          <label style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
            Name
          </label>
          <input
            name="name" type="text" placeholder="Your name"
            value={form.name} onChange={handleChange}
            data-testid="contact-name"
            style={{
              width: "100%", padding: "11px 14px",
              border: "2.5px solid #1A1A1A", borderRadius: "10px",
              fontFamily: "'Nunito', sans-serif", fontWeight: 600,
              fontSize: "14px", background: "#FFFDF8", outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>
        {/* Email */}
        <div>
          <label style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
            Email
          </label>
          <input
            name="email" type="email" placeholder="you@example.com"
            value={form.email} onChange={handleChange}
            data-testid="contact-email"
            style={{
              width: "100%", padding: "11px 14px",
              border: "2.5px solid #1A1A1A", borderRadius: "10px",
              fontFamily: "'Nunito', sans-serif", fontWeight: 600,
              fontSize: "14px", background: "#FFFDF8", outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
            onBlur={(e) => (e.target.style.boxShadow = "none")}
          />
        </div>
      </div>

      {/* Subject */}
      <div style={{ marginBottom: "16px" }}>
        <label style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
          Subject
        </label>
        <select
          name="subject" value={form.subject} onChange={handleChange}
          data-testid="contact-subject"
          style={{
            width: "100%", padding: "11px 14px",
            border: "2.5px solid #1A1A1A", borderRadius: "10px",
            fontFamily: "'Nunito', sans-serif", fontWeight: 600,
            fontSize: "14px", background: "#FFFDF8",
          }}
        >
          <option value="general">General question</option>
          <option value="bug">Bug report</option>
          <option value="feature">Feature request</option>
          <option value="university">University / team plan</option>
          <option value="press">Press inquiry</option>
        </select>
      </div>

      {/* Message */}
      <div style={{ marginBottom: "20px" }}>
        <label style={{ display: "block", fontWeight: 700, fontSize: "14px", color: "#1A1A1A", marginBottom: "6px" }}>
          Message
        </label>
        <textarea
          name="message" rows={5}
          placeholder="What's on your mind?"
          value={form.message} onChange={handleChange}
          data-testid="contact-message"
          style={{
            width: "100%", padding: "11px 14px",
            border: "2.5px solid #1A1A1A", borderRadius: "10px",
            fontFamily: "'Nunito', sans-serif", fontWeight: 600,
            fontSize: "14px", background: "#FFFDF8", outline: "none",
            resize: "vertical", boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.boxShadow = "3px 3px 0 #CBB2FE")}
          onBlur={(e) => (e.target.style.boxShadow = "none")}
        />
      </div>

      {errMsg && (
        <div style={{
          background: "#FFE4E4", border: "2px solid #FF6B6B",
          borderRadius: "8px", padding: "10px 14px",
          fontSize: "13px", color: "#CC0000", fontWeight: 600, marginBottom: "16px",
        }}>
          {errMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={status === "loading"}
        data-testid="contact-submit"
        style={{
          width: "100%", padding: "14px",
          background: status === "loading" ? "#ccc" : "#CBB2FE",
          border: "2.5px solid #1A1A1A", borderRadius: "12px",
          boxShadow: status === "loading" ? "none" : "4px 4px 0 #1A1A1A",
          fontFamily: "'Outfit', sans-serif", fontWeight: 800,
          fontSize: "16px", color: "#1A1A1A",
          cursor: status === "loading" ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
        }}
        onMouseDown={(e) => {
          if (status !== "loading") { e.currentTarget.style.transform = "translate(2px,2px)"; e.currentTarget.style.boxShadow = "2px 2px 0 #1A1A1A"; }
        }}
        onMouseUp={(e) => {
          if (status !== "loading") { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "4px 4px 0 #1A1A1A"; }
        }}
      >
        {status === "loading" ? "Sending…" : <><Mail size={17} /> Send message <ArrowRight size={16} /></>}
      </button>
    </form>
  );
}

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFDF8", fontFamily: "'Nunito', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* BG doodles */}
      <Star size={28} color="#FFB5E8" style={{ position: "absolute", top: "120px", left: "4%", opacity: 0.6, transform: "rotate(-15deg)" }} />
      <Star size={18} color="#FBEA8C" style={{ position: "absolute", top: "300px", right: "5%", opacity: 0.5 }} />
      <Squiggle color="#A0E8AF" style={{ position: "absolute", top: "500px", left: "2%", opacity: 0.4 }} />
      <Zigzag color="#CBB2FE" style={{ position: "absolute", bottom: "300px", right: "3%", opacity: 0.5 }} />

      <TopNav />

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "60px 24px 100px" }}>

        {/* ── Hero ── */}
        <section style={{ textAlign: "center", marginBottom: "72px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px" }}>
            <Sparkles size={18} color="#CBB2FE" />
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#888", fontWeight: 600 }}>
              our story
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "clamp(32px, 5vw, 52px)", color: "#1A1A1A",
            margin: "0 0 20px", lineHeight: 1.08,
          }}>
            We got tired of reading papers the hard way.
          </h1>
          <p style={{
            color: "#555", fontSize: "18px", fontWeight: 600,
            maxWidth: "580px", margin: "0 auto 32px", lineHeight: 1.6,
          }}>
            PaperComic started as a late-night side project -a tool to survive grad school,
            now available to every student and researcher who's ever stared blankly at an abstract.
          </p>
          <a href="/upload" style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "14px 28px",
            background: "#FFB5E8", border: "2.5px solid #1A1A1A",
            borderRadius: "14px", boxShadow: "5px 5px 0 #1A1A1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "17px", color: "#1A1A1A", textDecoration: "none",
          }}>
            Try it yourself <ArrowRight size={18} strokeWidth={2.5} />
          </a>
        </section>

        {/* ── Origin story ── */}
        <section style={{ marginBottom: "72px" }}>
          <div style={{
            background: "#FBEA8C", border: "3px solid #1A1A1A",
            borderRadius: "20px", boxShadow: "6px 6px 0 #1A1A1A",
            padding: "36px 40px",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: "-18px", left: "32px",
              background: "#1A1A1A", color: "#FBEA8C",
              fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: "15px",
              padding: "4px 14px", borderRadius: "8px",
            }}>
              how it started
            </div>
            <p style={{ fontSize: "16px", color: "#333", lineHeight: 1.8, fontWeight: 600, margin: "8px 0 16px" }}>
              It was 1 AM before a seminar. A 58-page transformer paper sat open on one screen,
              a blinking cursor on the other. Instead of skimming for the third time, I wondered —
              what if an AI could just <em>draw me the gist</em>?
            </p>
            <p style={{ fontSize: "16px", color: "#333", lineHeight: 1.8, fontWeight: 600, margin: 0 }}>
              The first prototype spit out six janky stick-figure panels. I understood the paper
              in four minutes. PaperComic was born.
            </p>
            <div style={{
              marginTop: "20px",
              fontFamily: "'Caveat', cursive", fontSize: "18px", color: "#888", fontWeight: 700,
            }}>
              -Jas, founder
            </div>
          </div>
        </section>

        {/* ── Values ── */}
        <section style={{ marginBottom: "72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
            <Heart size={18} color="#FF6B6B" />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "28px", color: "#1A1A1A", margin: 0 }}>
              What we believe
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "18px" }}>
            {VALUES.map((v) => (
              <div key={v.title} style={{
                background: v.bg, border: "2.5px solid #1A1A1A",
                borderRadius: "16px", boxShadow: "4px 4px 0 #1A1A1A",
                padding: "22px 20px",
              }}>
                <div style={{ marginBottom: "10px" }}>{v.icon}</div>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                  fontSize: "16px", color: "#1A1A1A", margin: "0 0 8px",
                }}>
                  {v.title}
                </h3>
                <p style={{ fontSize: "13px", color: "#444", fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Team ── */}
        <section style={{ marginBottom: "72px" }}>
          <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "28px", color: "#1A1A1A", marginBottom: "24px" }}>
            Who made this
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px" }}>
            {TEAM.map((member) => (
              <div key={member.name} style={{
                background: "#fff", border: "2.5px solid #1A1A1A",
                borderRadius: "16px", boxShadow: "4px 4px 0 #1A1A1A",
                padding: "24px 22px",
                display: "flex", gap: "16px", alignItems: "flex-start",
              }}>
                <PeepAvatar bg={member.bg} initial={member.name[0]} size={56} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "18px", color: "#1A1A1A" }}>
                      {member.name}
                    </span>
                    {member.isMachine && (
                      <span style={{
                        background: "#A0E8AF", border: "1.5px solid #1A1A1A",
                        borderRadius: "6px", padding: "1px 7px",
                        fontSize: "10px", fontWeight: 800,
                      }}>AI</span>
                    )}
                  </div>
                  <div style={{
                    fontFamily: "'Caveat', cursive", fontSize: "14px",
                    color: "#888", fontWeight: 600, marginBottom: "8px",
                  }}>
                    {member.role}
                  </div>
                  <p style={{ fontSize: "13px", color: "#555", fontWeight: 600, lineHeight: 1.5, margin: "0 0 10px" }}>
                    {member.bio}
                  </p>
                  {Object.keys(member.links).length > 0 && (
                    <div style={{ display: "flex", gap: "10px" }}>
                      {member.links.github && (
                        <a href={member.links.github} style={{
                          display: "flex", alignItems: "center", gap: "4px",
                          fontSize: "12px", color: "#555", textDecoration: "none",
                          fontWeight: 700, border: "1.5px solid #CCC",
                          borderRadius: "6px", padding: "3px 8px",
                        }}>
                          <GithubIcon size={12} /> GitHub
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact">
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
            <Mail size={18} color="#CBB2FE" />
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "28px", color: "#1A1A1A", margin: 0 }}>
              Get in touch
            </h2>
          </div>
          <p style={{ color: "#666", fontSize: "15px", fontWeight: 600, marginBottom: "28px" }}>
            Questions, bugs, feature ideas, university deals -we read every message.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "28px", alignItems: "start" }}>
            {/* Direct links */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {[
                { icon: <Mail size={18} />, label: "Email us", value: "hello@papercomic.app", href: "mailto:hello@papercomic.app", bg: "#CBB2FE" },
                { icon: <GithubIcon size={18} />, label: "GitHub", value: "github.com/papercomic", href: "https://github.com/papercomic", bg: "#FBEA8C" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{
                    display: "flex", alignItems: "center", gap: "14px",
                    padding: "14px 18px",
                    background: link.bg, border: "2.5px solid #1A1A1A",
                    borderRadius: "12px", boxShadow: "3px 3px 0 #1A1A1A",
                    textDecoration: "none", color: "#1A1A1A",
                    transition: "transform 0.1s, box-shadow 0.1s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translate(-2px,-2px)"; e.currentTarget.style.boxShadow = "5px 5px 0 #1A1A1A"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "3px 3px 0 #1A1A1A"; }}
                >
                  <div style={{
                    width: "36px", height: "36px", flexShrink: 0,
                    background: "#fff", border: "2px solid #1A1A1A",
                    borderRadius: "8px", boxShadow: "2px 2px 0 #1A1A1A",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    {link.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "14px" }}>{link.label}</div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontSize: "12px", color: "#555", fontWeight: 600 }}>{link.value}</div>
                  </div>
                </a>
              ))}

              {/* Response time */}
              <div style={{
                background: "#FFFDF8", border: "2px dashed #CCC",
                borderRadius: "10px", padding: "12px 16px",
                fontFamily: "'Caveat', cursive", fontSize: "14px", color: "#888", fontWeight: 600,
                display: "flex", alignItems: "center", gap: "6px",
              }}>
                <Clock size={16} color="#888" strokeWidth={2} /> Typical response time: under 24 hours
              </div>
            </div>

            {/* Contact form */}
            <div style={{
              background: "#fff", border: "2.5px solid #1A1A1A",
              borderRadius: "16px", boxShadow: "5px 5px 0 #1A1A1A",
              padding: "28px 24px",
            }}>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: "2.5px solid #1A1A1A",
        padding: "24px",
        textAlign: "center",
        fontFamily: "'Nunito', sans-serif", fontSize: "13px", color: "#888", fontWeight: 600,
      }}>
        Made with <Heart size={12} style={{ display: "inline", verticalAlign: "middle", color: "#FF6B6B" }} /> by PaperComic ·{" "}
        <a href="/pricing" style={{ color: "#888" }}>Pricing</a> ·{" "}
        <a href="/terms" style={{ color: "#888" }}>Terms</a> ·{" "}
        <a href="/privacy" style={{ color: "#888" }}>Privacy</a>
      </footer>
    </div>
  );
}