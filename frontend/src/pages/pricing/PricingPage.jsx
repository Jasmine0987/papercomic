import { useState, useEffect, useCallback } from "react";
import { Check, Zap, BookOpen, Users, Sparkles, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import TopNav from "../../components/TopNav";

function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

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

const PLANS = [
  {
    id: "free",
    name: "Free",
    badge: "Always free",
    badgeColor: "#A0E8AF",
    price: { monthly: 0, yearly: 0 },
    accent: "#A0E8AF",
    icon: <BookOpen size={22} color="#1A1A1A" />,
    cta: "Start free",
    features: [
      "3 comic generations",
      "Up to 16 panels per comic",
      "Manga / sketch style",
      "Save comics to library",
      "Share comics via link",
    ],
    missing: [
      "Unlimited generations",
      "Higher-quality AI art",
      "Priority generation queue",
      "Team workspace",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    badge: "Most popular",
    badgeColor: "#CBB2FE",
    price: { monthly: 9, yearly: 7 },
    accent: "#CBB2FE",
    icon: <Zap size={22} color="#1A1A1A" />,
    cta: "Upgrade to Pro",
    highlighted: true,
    features: [
      "Unlimited comic generations",
      "Higher-quality AI art (Nano Banana)",
      "Up to 16 panels per comic",
      "All comic styles",
      "Priority generation queue",
      "Save & organize library",
      "Share with custom link",
    ],
    missing: ["Team workspace"],
  },
  {
    id: "team",
    name: "Team",
    badge: "For labs & classes",
    badgeColor: "#FBEA8C",
    price: { monthly: 24, yearly: 18 },
    priceSuffix: "/ seat",
    accent: "#FBEA8C",
    icon: <Users size={22} color="#1A1A1A" />,
    cta: "Upgrade to Team",
    features: [
      "Everything in Pro",
      "Shared team library",
      "Bulk PDF upload",
      "Admin dashboard",
      "Priority support",
    ],
    missing: [],
  },
];

function PlanCard({ plan, billing, currentPlan, onUpgrade, upgrading }) {
  const price = billing === "yearly" ? plan.price.yearly : plan.price.monthly;
  const [hovered, setHovered] = useState(false);
  const isCurrentPlan = currentPlan === plan.id;
  const isLoading = upgrading === plan.id;

  return (
    <div
      data-testid={`plan-${plan.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: plan.highlighted ? plan.accent : "#fff",
        border: `${plan.highlighted ? "3px" : "2.5px"} solid #1A1A1A`,
        borderRadius: "20px",
        boxShadow: hovered ? "8px 8px 0 #1A1A1A" : plan.highlighted ? "6px 6px 0 #1A1A1A" : "4px 4px 0 #1A1A1A",
        padding: "28px 24px",
        display: "flex", flexDirection: "column",
        transform: hovered ? "translate(-2px,-2px)" : "none",
        transition: "transform 0.15s, box-shadow 0.15s",
        position: "relative",
      }}
    >
      {/* Badge */}
      <div style={{
        position: "absolute", top: "-14px", left: "20px",
        background: plan.badgeColor, border: "2px solid #1A1A1A",
        borderRadius: "20px", padding: "3px 12px",
        fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "12px",
        boxShadow: "2px 2px 0 #1A1A1A",
      }}>
        {plan.badge}
      </div>

      {/* Icon + name */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px", marginTop: "8px" }}>
        <div style={{
          width: "42px", height: "42px",
          background: "#fff", border: "2px solid #1A1A1A",
          borderRadius: "10px", boxShadow: "2px 2px 0 #1A1A1A",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {plan.icon}
        </div>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "22px", color: "#1A1A1A" }}>
          {plan.name}
        </span>
      </div>

      {/* Price */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "40px", color: "#1A1A1A" }}>
            ${price}
          </span>
          {price > 0 && (
            <span style={{ fontSize: "15px", color: "#555", fontWeight: 600 }}>
              / mo{plan.priceSuffix || ""}
            </span>
          )}
        </div>
        {price === 0 && (
          <div style={{ color: "#555", fontSize: "14px", fontWeight: 600, marginTop: "4px" }}>
            No credit card needed
          </div>
        )}
      </div>

      {/* CTA */}
      {isCurrentPlan ? (
        <div
          data-testid={`cta-${plan.id}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "13px",
            background: "#fff", border: "2.5px solid #1A1A1A", borderRadius: "12px",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "15px",
            color: "#888", marginBottom: "24px",
          }}
        >
          <Check size={16} /> Current plan
        </div>
      ) : (
        <button
          onClick={() => onUpgrade(plan.id)}
          disabled={isLoading}
          data-testid={`cta-${plan.id}`}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
            padding: "13px", width: "100%",
            background: isLoading ? "#ccc" : plan.highlighted ? "#1A1A1A" : plan.accent,
            border: "2.5px solid #1A1A1A",
            borderRadius: "12px", boxShadow: isLoading ? "none" : "3px 3px 0 #1A1A1A",
            fontFamily: "'Outfit', sans-serif", fontWeight: 800,
            fontSize: "15px", cursor: isLoading ? "not-allowed" : "pointer",
            color: plan.highlighted ? "#fff" : "#1A1A1A",
            textDecoration: "none", marginBottom: "24px",
          }}
        >
          {isLoading ? (
            <Loader2 size={16} style={{ animation: "pc-spin 1s linear infinite" }} />
          ) : (
            <>{plan.cta} <ArrowRight size={16} /></>
          )}
        </button>
      )}

      {/* Features */}
      <div style={{ flex: 1 }}>
        <div style={{
          fontFamily: "'Caveat', cursive", fontSize: "14px", color: "#666",
          fontWeight: 600, marginBottom: "10px",
        }}>
          What's included:
        </div>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" }}>
          {plan.features.map((f, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <div style={{
                width: "20px", height: "20px", flexShrink: 0, marginTop: "1px",
                background: plan.highlighted ? "#1A1A1A" : plan.accent,
                border: "1.5px solid #1A1A1A", borderRadius: "5px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Check size={12} color={plan.highlighted ? "#fff" : "#1A1A1A"} strokeWidth={3} />
              </div>
              <span style={{ fontFamily: "'Nunito', sans-serif", fontSize: "14px", color: "#333", fontWeight: 600, lineHeight: 1.4 }}>
                {f}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// FAQ items
const FAQS = [
  { q: "Can I cancel anytime?", a: "Yes -cancel your subscription anytime. Your plan stays active until the end of the current billing cycle." },
  { q: "What counts as a generation?", a: "Each PDF you convert into a comic counts as one generation, regardless of how many panels it has." },
  { q: "Is my PDF data kept private?", a: "Your PDFs are processed to generate your comic and are not shared with third parties beyond what's needed for AI generation (Google's Gemini API, and Pollinations.ai for free-tier art)." },
  { q: "What's different about Pro/Team art quality?", a: "Free plan comics use Pollinations.ai for illustration, which is free but less consistent. Pro and Team plans use Google's Nano Banana image model for higher-quality, more consistent panel art." },
  { q: "Do you offer discounts for universities?", a: "Reach out via the About page and we'll work something out for departmental or classroom use." },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section style={{ maxWidth: "680px", margin: "80px auto 0" }}>
      <h2 style={{
        fontFamily: "'Outfit', sans-serif", fontWeight: 900,
        fontSize: "32px", color: "#1A1A1A", textAlign: "center", marginBottom: "32px",
      }}>
        Questions
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {FAQS.map((faq, i) => (
          <div
            key={i}
            style={{
              background: "#fff", border: "2.5px solid #1A1A1A",
              borderRadius: "14px", boxShadow: "3px 3px 0 #1A1A1A",
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              data-testid={`faq-${i}`}
              style={{
                width: "100%", padding: "16px 20px",
                background: "none", border: "none", cursor: "pointer",
                display: "flex", justifyContent: "space-between", alignItems: "center",
                textAlign: "left",
              }}
            >
              <span style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "16px", color: "#1A1A1A" }}>
                {faq.q}
              </span>
              <span style={{
                fontFamily: "'Outfit', sans-serif", fontWeight: 900,
                fontSize: "20px", color: "#CBB2FE", marginLeft: "12px", flexShrink: 0,
              }}>
                {open === i ? "−" : "+"}
              </span>
            </button>
            {open === i && (
              <div style={{
                padding: "0 20px 18px",
                fontFamily: "'Nunito', sans-serif", fontSize: "15px",
                color: "#555", fontWeight: 600, lineHeight: 1.6,
                borderTop: "1.5px solid #E5E5E5",
                paddingTop: "14px",
              }}>
                {faq.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function PricingPage() {
  const [billing, setBilling] = useState("monthly");
  const [usage, setUsage] = useState(null); // null = not logged in or not yet loaded
  const [upgrading, setUpgrading] = useState(null); // plan id currently processing
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeSuccess, setUpgradeSuccess] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("pc_token");
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setUsage(data))
      .catch(() => {});
  }, []);

  const handleUpgrade = useCallback(async (planId) => {
    const token = localStorage.getItem("pc_token");

    if (planId === "free") {
      window.location.href = "/signup";
      return;
    }

    if (!token) {
      window.location.href = `/signup?plan=${planId}`;
      return;
    }

    setUpgradeError("");
    setUpgrading(planId);

    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Could not load the payment widget. Check your connection and try again.");
      }

      const subRes = await fetch("/api/billing/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan: planId }),
      });
      if (!subRes.ok) {
        const e = await subRes.json();
        throw new Error(typeof e.detail === "string" ? e.detail : "Could not start checkout");
      }
      const { subscription_id, razorpay_key_id } = await subRes.json();

      const options = {
        key: razorpay_key_id,
        subscription_id,
        name: "PaperComic",
        description: `${planId === "pro" ? "Pro" : "Team"} plan subscription`,
        prefill: { email: usage?.email || "" },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/billing/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_subscription_id: response.razorpay_subscription_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            if (verifyRes.ok) {
              setUpgradeSuccess(true);
              // Refresh usage -note: the durable plan flip happens via the
              // webhook server-side, so this may briefly still show "free"
              // until the webhook lands. We optimistically refetch once.
              const meRes = await fetch("/api/auth/me", {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (meRes.ok) setUsage(await meRes.json());
            } else {
              setUpgradeError("Payment verification failed. If you were charged, contact support.");
            }
          } finally {
            setUpgrading(null);
          }
        },
        modal: {
          ondismiss: () => setUpgrading(null),
        },
        theme: { color: "#CBB2FE" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      setUpgradeError(err.message);
      setUpgrading(null);
    }
  }, [usage]);

  return (
    <div style={{ minHeight: "100vh", background: "#FFFDF8", fontFamily: "'Nunito', sans-serif", position: "relative", overflow: "hidden" }}>
      {/* BG doodles */}
      <style>{`@keyframes pc-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }`}</style>
      <Star size={32} color="#FFB5E8" style={{ position: "absolute", top: "100px", left: "5%", opacity: 0.6, transform: "rotate(-20deg)" }} />
      <Star size={20} color="#FBEA8C" style={{ position: "absolute", top: "200px", right: "4%", opacity: 0.5 }} />
      <Squiggle color="#A0E8AF" style={{ position: "absolute", top: "320px", left: "2%", opacity: 0.4 }} />
      <Star size={14} color="#CBB2FE" style={{ position: "absolute", bottom: "200px", right: "8%", opacity: 0.5 }} />

      <TopNav usage={usage} user={usage ? { name: usage.name, email: usage.email, id: usage.id } : null} />

      <main style={{ maxWidth: "1100px", margin: "0 auto", padding: "60px 24px 100px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", marginBottom: "12px" }}>
            <Sparkles size={18} color="#CBB2FE" />
            <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: "#888", fontWeight: 600 }}>
              simple pricing
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Outfit', sans-serif", fontWeight: 900,
            fontSize: "clamp(32px, 5vw, 52px)", color: "#1A1A1A",
            margin: "0 0 14px", lineHeight: 1.05,
          }}>
            Start free. Upgrade when
            <br />
            <span style={{
              background: "#CBB2FE", borderRadius: "8px", padding: "0 8px",
              border: "2px solid #1A1A1A",
            }}>
              your stack of papers grows.
            </span>
          </h1>
          <p style={{ color: "#666", fontSize: "17px", fontWeight: 600, margin: "0 auto", maxWidth: "480px" }}>
            No subscription traps. Cancel anytime. The free plan includes 3 comic generations to get started.
          </p>
        </div>

        {/* Billing toggle */}
        {/* NOTE: yearly pricing shown here is for display only right now —
            RAZORPAY_PRO_PLAN_ID / RAZORPAY_TEAM_PLAN_ID currently point to a
            single (monthly) plan each. Create separate yearly plan IDs in
            Razorpay and branch on `billing` in handleUpgrade before this
            toggle actually changes what gets charged. */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "40px" }}>
          <div style={{
            display: "inline-flex",
            background: "#fff", border: "2.5px solid #1A1A1A",
            borderRadius: "12px", padding: "4px",
            boxShadow: "3px 3px 0 #1A1A1A",
          }}>
            {["monthly", "yearly"].map((b) => (
              <button
                key={b}
                onClick={() => setBilling(b)}
                data-testid={`billing-${b}`}
                style={{
                  padding: "9px 20px",
                  background: billing === b ? "#FBEA8C" : "transparent",
                  border: billing === b ? "2px solid #1A1A1A" : "2px solid transparent",
                  borderRadius: "8px",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 800,
                  fontSize: "14px", color: "#1A1A1A", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px",
                }}
              >
                {b === "yearly" ? "Yearly" : "Monthly"}
                {b === "yearly" && (
                  <span style={{
                    background: "#A0E8AF", border: "1.5px solid #1A1A1A",
                    borderRadius: "4px", padding: "0 5px",
                    fontSize: "10px", fontWeight: 800,
                  }}>
                    −25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Upgrade feedback banners */}
        {upgradeError && (
          <div style={{
            maxWidth: "560px", margin: "0 auto 24px",
            background: "#FFE4E4", border: "2px solid #FF6B6B", borderRadius: "12px",
            padding: "12px 18px", fontSize: "14px", color: "#CC0000", fontWeight: 600,
          }}>
            {upgradeError}
          </div>
        )}
        {upgradeSuccess && (
          <div style={{
            maxWidth: "560px", margin: "0 auto 24px",
            background: "#A0E8AF", border: "2px solid #1A1A1A", borderRadius: "12px",
            padding: "12px 18px", fontSize: "14px", color: "#1A1A1A", fontWeight: 700,
            textAlign: "center",
          }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><CheckCircle2 size={16} /> Payment received! Your plan will update within a few seconds -head to <a href="/upload" style={{ color: "#1A1A1A", textDecoration: "underline" }}>Upload</a> to start.</span>
          </div>
        )}

        {/* Plans grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "24px",
          alignItems: "start",
        }}>
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              billing={billing}
              currentPlan={usage?.plan || "free"}
              onUpgrade={handleUpgrade}
              upgrading={upgrading}
            />
          ))}
        </div>

        <FAQ />
      </main>
    </div>
  );
}