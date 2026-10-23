"use client";

/**
 * The reasoning view: run the agent and show what it did as a vertical
 * timeline. The API returns one batch response, so this is not live
 * streaming; the stagger just reveals events in the order they happened.
 */

import { useEffect, useState } from "react";
import { runKitchenProcurement, KitchenRunResult, TraceStep } from "../lib/api";

const COLORS = {
  terracotta: "#B85042",
  sand: "#E7E8D1",
  sage: "#A7BEAE",
  dark: "#2B2118",
  ink: "#2B2118",
  muted: "#6B5D52",
  white: "#FFFFFF",
  green: "#7A9B76",
  bg: "#FAF8F4",
};

const FONT_DISPLAY = "Cambria, Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

const STEP_META: Record<TraceStep["step_type"], { label: string; color: string }> = {
  plan: { label: "AGENT", color: COLORS.muted },
  tool_call: { label: "ACTION", color: COLORS.terracotta },
  tool_result: { label: "RESULT", color: COLORS.sage },
  decision: { label: "DECISION", color: COLORS.green },
};

const DEFAULT_MENU = ["onion curry", "tomato dal"];

export default function Home() {
  const [menuItems, setMenuItems] = useState<string[]>(DEFAULT_MENU);
  const [menuDraft, setMenuDraft] = useState("");
  const [studentCount, setStudentCount] = useState(120);
  const [useCustomBudget, setUseCustomBudget] = useState(false);
  const [budget, setBudget] = useState(1500);

  const [result, setResult] = useState<KitchenRunResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  function addMenuItem() {
    const v = menuDraft.trim();
    if (v && !menuItems.includes(v)) setMenuItems([...menuItems, v]);
    setMenuDraft("");
  }
  function removeMenuItem(item: string) {
    setMenuItems(menuItems.filter((m) => m !== item));
  }

  async function handleRun() {
    if (menuItems.length === 0) {
      setError("Add at least one dish to the menu before running the agent.");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setElapsed(0);
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    try {
      const res = await runKitchenProcurement(
        menuItems,
        studentCount,
        useCustomBudget ? budget : undefined
      );
      setResult(res);
    } catch (e) {
      setError(
        e instanceof Error
          ? `${e.message}. Check that the backend is running on localhost:8000 with a real GROQ_API_KEY set.`
          : "Something went wrong reaching the backend."
      );
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: FONT_BODY }}>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 32px 96px" }}>
        {/* Header */}
        <div style={{ marginBottom: 40 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              color: COLORS.terracotta,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Procurement Co-Pilot
          </div>
          <h1
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 34,
              fontWeight: 700,
              color: COLORS.ink,
              margin: 0,
            }}
          >
            Live Reasoning View
          </h1>
          <p style={{ color: COLORS.muted, fontSize: 15, marginTop: 8, maxWidth: 560 }}>
            Set tonight's menu, run the agent, and watch it check real vendor prices,
            enforce the budget, and adapt if a vendor fails, live against Groq.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 32 }} className="layout-grid">
          {/* Control panel */}
          <div>
            <Panel>
              <FieldLabel>Tonight's menu</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                {menuItems.map((item) => (
                  <Chip key={item} onRemove={() => removeMenuItem(item)}>
                    {item}
                  </Chip>
                ))}
                {menuItems.length === 0 && (
                  <span style={{ fontSize: 13, color: COLORS.muted, fontStyle: "italic" }}>
                    No dishes added yet
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={menuDraft}
                  onChange={(e) => setMenuDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addMenuItem();
                    }
                  }}
                  placeholder="Add a dish, press Enter"
                  className="input-field" style={inputStyle}
                />
                <button onClick={addMenuItem} className="btn" style={secondaryButtonStyle}>
                  Add
                </button>
              </div>

              <div style={{ height: 20 }} />

              <FieldLabel>Students eating tonight</FieldLabel>
              <input
                type="number"
                value={studentCount}
                onChange={(e) => setStudentCount(Number(e.target.value))}
                className="input-field" style={inputStyle}
                min={1}
              />

              <div style={{ height: 20 }} />

              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={useCustomBudget}
                  onChange={(e) => setUseCustomBudget(e.target.checked)}
                />
                <span style={{ fontSize: 13.5, color: COLORS.ink }}>Set a custom budget</span>
              </label>
              {useCustomBudget && (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(Number(e.target.value))}
                    className="input-field" style={inputStyle}
                    min={0}
                  />
                  <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 6 }}>
                    Leave unchecked and the backend computes a sensible default itself.
                  </p>
                </div>
              )}

              <div style={{ height: 24 }} />

              <button onClick={handleRun} disabled={loading} className="btn" style={primaryButtonStyle(loading)}>
                {loading ? `Agent is working... ${elapsed}s` : "Run the agent"}
              </button>
              {loading && (
                <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, textAlign: "center" }}>
                  Real calls to Groq in sequence, this can take up to a minute.
                </p>
              )}
            </Panel>

            {error && (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 10,
                  background: "#FBEAE7",
                  border: `1px solid ${COLORS.terracotta}`,
                  fontSize: 13.5,
                  color: COLORS.ink,
                  lineHeight: 1.5,
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* Results */}
          <div>
            {!result && !loading && !error && (
              <EmptyState />
            )}

            {loading && <LoadingState />}

            {result && result.status === "no_action_needed" && (
              <Panel>
                <div style={{ textAlign: "center", padding: "40px 20px" }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{"\u2713"}</div>
                  <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink, margin: 0 }}>
                    No procurement needed
                  </p>
                  <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 8 }}>{result.message}</p>
                </div>
              </Panel>
            )}

            {result && result.trace && (
              <>
                {result.budget != null && (
                  <BudgetBar budget={result.budget} spent={result.spent ?? 0} />
                )}

                <div style={{ marginTop: 24 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      color: COLORS.muted,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    Reasoning Trail
                  </div>
                  <ReasoningTrail steps={result.trace} />
                </div>

                <div style={{ marginTop: 28 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 1.5,
                      color: COLORS.muted,
                      textTransform: "uppercase",
                      marginBottom: 12,
                    }}
                  >
                    Summary
                  </div>
                  <Panel accent>
                    <p style={{ whiteSpace: "pre-wrap", fontSize: 14.5, color: COLORS.ink, lineHeight: 1.6, margin: 0 }}>
                      {result.summary}
                    </p>
                  </Panel>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media (max-width: 860px) {
          .layout-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------- small building blocks ---------- */

function Panel({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      style={{
        background: accent ? COLORS.sand : COLORS.white,
        border: accent ? "none" : `1px solid #E5DFD3`,
        borderRadius: 14,
        padding: 22,
        boxShadow: accent ? "none" : "0 1px 2px rgba(43, 33, 24, 0.06), 0 1px 1px rgba(43, 33, 24, 0.04)",
      }}
    >
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: 0.8,
        color: COLORS.muted,
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {children}
    </label>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: COLORS.sand,
        color: COLORS.ink,
        borderRadius: 999,
        padding: "5px 6px 5px 12px",
        fontSize: 13,
        animation: "fadeSlideIn 0.25s cubic-bezier(0.22, 1, 0.36, 1) both",
      }}
    >
      {children}
      <button
        onClick={onRemove}
        aria-label={`Remove ${children}`}
        className="chip-x"
        style={{
          border: "none",
          background: "transparent",
          cursor: "pointer",
          color: COLORS.muted,
          fontSize: 15,
          lineHeight: 1,
          padding: "2px 4px",
          borderRadius: 999,
        }}
      >
        {"\u00d7"}
      </button>
    </span>
  );
}

function EmptyState() {
  return (
    <Panel>
      <div style={{ textAlign: "center", padding: "56px 20px" }}>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 20, color: COLORS.ink, margin: 0 }}>
          Nothing running yet
        </p>
        <p style={{ color: COLORS.muted, fontSize: 14, marginTop: 8, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
          Set the menu on the left and run the agent to see it check vendors, enforce the budget, and place real orders.
        </p>
      </div>
    </Panel>
  );
}

function LoadingState() {
  return (
    <Panel>
      <div style={{ textAlign: "center", padding: "56px 20px" }}>
        <div className="pulse-dots" style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
          <span className="dot" style={{ animationDelay: "0s" }} />
          <span className="dot" style={{ animationDelay: "0.15s" }} />
          <span className="dot" style={{ animationDelay: "0.3s" }} />
        </div>
        <p style={{ fontFamily: FONT_DISPLAY, fontSize: 18, color: COLORS.ink, margin: 0 }}>
          Checking prices, availability, and budget
        </p>
        <p style={{ color: COLORS.muted, fontSize: 13.5, marginTop: 6 }}>
          Real calls to the model, not a simulation.
        </p>
      </div>
      <style jsx>{`
        .dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${COLORS.terracotta};
          animation: bounce 1s infinite ease-in-out;
        }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Panel>
  );
}

function BudgetBar({ budget, spent }: { budget: number; spent: number }) {
  const targetPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const remaining = Math.max(0, budget - spent);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    // Start at 0 so the fill genuinely animates in, rather than
    // snapping to its final width on the first paint.
    const t = setTimeout(() => setPct(targetPct), 60);
    return () => clearTimeout(t);
  }, [targetPct]);

  return (
    <Panel>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: COLORS.muted, textTransform: "uppercase" }}>
          Budget
        </span>
        <span style={{ fontFamily: FONT_MONO, fontSize: 13.5, color: COLORS.ink }}>
          {"\u20b9"}{spent.toFixed(2)} of {"\u20b9"}{budget.toFixed(2)}
        </span>
      </div>
      <div style={{ height: 12, background: COLORS.sand, borderRadius: 999, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: pct > 90 ? COLORS.terracotta : COLORS.green,
            borderRadius: 999,
            transition: "width 0.9s cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      </div>
      <p style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, marginBottom: 0 }}>
        {"\u20b9"}{remaining.toFixed(2)} remaining
      </p>
    </Panel>
  );
}

function ReasoningTrail({ steps }: { steps: TraceStep[] }) {
  return (
    <div style={{ position: "relative", paddingLeft: 4 }}>
      <div
        style={{
          position: "absolute",
          left: 15,
          top: 8,
          bottom: 8,
          width: 2,
          background: "#E5DFD3",
          transformOrigin: "top",
          animation: "drawLine 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        }}
      />
      {steps.map((step, i) => {
        const meta = STEP_META[step.step_type] || STEP_META.plan;
        const isLast = i === steps.length - 1;
        return (
          <div
            key={step.id}
            style={{
              position: "relative",
              display: "flex",
              gap: 16,
              marginBottom: 14,
              animation: "fadeSlideIn 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
              animationDelay: `${Math.min(i * 0.06, 1.2)}s`,
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: meta.color,
                flexShrink: 0,
                zIndex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: isLast ? "softPulse 1.8s ease-out 1" : undefined,
                animationDelay: isLast ? `${Math.min(i * 0.06, 1.2) + 0.3}s` : undefined,
              }}
            >
              <StepIcon type={step.step_type} />
            </div>
            <div
              className="card-interactive"
              style={{
                flex: 1,
                background: COLORS.white,
                border: "1px solid #E5DFD3",
                borderRadius: 10,
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  color: meta.color,
                  marginBottom: 4,
                }}
              >
                {meta.label}
              </div>
              <div style={{ fontSize: 14, color: COLORS.ink, lineHeight: 1.5 }}>
                {step.content.event ?? summarizeFallback(step)}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepIcon({ type }: { type: TraceStep["step_type"] }) {
  const symbol = { plan: "\u25CF", tool_call: "\u2192", tool_result: "\u2713", decision: "\u2605" }[type] || "\u25CF";
  return <span style={{ color: COLORS.white, fontSize: 13 }}>{symbol}</span>;
}

function summarizeFallback(step: TraceStep) {
  if (step.step_type === "plan" && typeof step.content.text === "string") return step.content.text;
  if (step.step_type === "decision" && typeof step.content.summary === "string") return step.content.summary;
  return "Step recorded";
}

/* ---------- shared inline styles ---------- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: `1px solid #D9D2C3`,
  borderRadius: 8,
  fontFamily: FONT_BODY,
  color: COLORS.ink,
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: 13.5,
  fontWeight: 600,
  border: `1px solid #D9D2C3`,
  borderRadius: 8,
  background: COLORS.white,
  color: COLORS.ink,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function primaryButtonStyle(loading: boolean): React.CSSProperties {
  return {
    width: "100%",
    padding: "13px 16px",
    fontSize: 14.5,
    fontWeight: 700,
    border: "none",
    borderRadius: 8,
    background: loading ? COLORS.muted : COLORS.terracotta,
    color: COLORS.white,
    cursor: loading ? "default" : "pointer",
    transition: "background 0.15s ease, transform 0.1s ease",
  };
}
