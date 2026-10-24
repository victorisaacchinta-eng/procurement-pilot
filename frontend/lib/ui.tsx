"use client";

/**
 * Shared design tokens and small building blocks, used across every page
 * so the vendors/orders/inventory/demo screens feel like one product
 * instead of five separately-built pages. Same brand as every deck
 * delivered for this project: terracotta/sand/sage/dark, Cambria
 * display, system-ui body, no em dashes in any copy.
 *
 * Motion follows Emil Kowalski's principles from the project's own
 * design system doc: fast enough to feel responsive, deliberate, never
 * bouncy, transform/opacity only, reduced-motion respected everywhere.
 * The signature touch here is the nav bar's sliding indicator, it
 * measures the active link's real position and animates to it, rather
 * than a static border that jumps.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const COLORS = {
  terracotta: "#B85042",
  terracottaDark: "#9A4237",
  sand: "#E7E8D1",
  sage: "#A7BEAE",
  dark: "#2B2118",
  ink: "#2B2118",
  muted: "#6B5D52",
  white: "#FFFFFF",
  green: "#7A9B76",
  red: "#B85042",
  bg: "#FAF8F4",
  border: "#E5DFD3",
};

export const FONT_DISPLAY = "Cambria, Georgia, 'Times New Roman', serif";
export const FONT_BODY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
export const FONT_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

// Deliberate, not bouncy, Kowalski's "fast enough to feel responsive."
export const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
export const EASE_FAST = "cubic-bezier(0.4, 0, 0.2, 1)";

// Warm-tinted shadows, not generic gray, so elevation still reads as
// part of this brand rather than a default browser drop-shadow.
export const SHADOW_SM = "0 1px 2px rgba(43, 33, 24, 0.06), 0 1px 1px rgba(43, 33, 24, 0.04)";
export const SHADOW_MD = "0 4px 14px rgba(43, 33, 24, 0.08), 0 2px 4px rgba(43, 33, 24, 0.05)";
export const SHADOW_LG = "0 12px 28px rgba(43, 33, 24, 0.12), 0 4px 8px rgba(43, 33, 24, 0.06)";

export const STATUS_COLOR: Record<string, string> = {
  placed: COLORS.green,
  partial: COLORS.terracotta,
  needs_approval: "#C99A3E",
  over_budget: COLORS.terracotta,
  rejected: COLORS.red,
  failed: COLORS.muted,
  exceeds_shortage: COLORS.muted,
};

/**
 * Renders once, high in the tree (layout.tsx). Keyframes and
 * interaction classes referenced by className across every page,
 * kept in one place so a hover or press feels identical everywhere.
 */
export function GlobalStyles() {
  return (
    <style jsx global>{`
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
      }
      ::selection {
        background: ${COLORS.terracotta};
        color: ${COLORS.white};
      }

      .btn {
        transition: transform 0.12s ${EASE_FAST}, box-shadow 0.15s ${EASE_FAST},
          background 0.15s ${EASE_FAST}, opacity 0.15s ${EASE_FAST};
      }
      .btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: ${SHADOW_MD};
      }
      .btn:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
        box-shadow: ${SHADOW_SM};
      }
      .btn:disabled {
        cursor: default;
      }

      .input-field {
        transition: border-color 0.15s ${EASE_FAST}, box-shadow 0.15s ${EASE_FAST};
      }
      .input-field:hover {
        border-color: #c9bfa8;
      }
      .input-field:focus {
        outline: none;
        border-color: ${COLORS.terracotta};
        box-shadow: 0 0 0 3px rgba(184, 80, 66, 0.12);
      }

      .card-interactive {
        transition: transform 0.2s ${EASE}, box-shadow 0.2s ${EASE},
          border-color 0.2s ${EASE};
      }
      .card-interactive:hover {
        transform: translateY(-3px);
        box-shadow: ${SHADOW_LG};
        border-color: transparent;
      }

      .chip-x {
        transition: background 0.12s ${EASE_FAST}, color 0.12s ${EASE_FAST};
      }
      .chip-x:hover {
        background: rgba(43, 33, 24, 0.08);
      }

      .table-row-hover {
        transition: background 0.12s ${EASE_FAST};
      }
      .table-row-hover:hover {
        background: rgba(184, 80, 66, 0.05) !important;
      }

      a:focus-visible,
      button:focus-visible,
      input:focus-visible {
        outline: 2px solid ${COLORS.terracotta};
        outline-offset: 2px;
      }

      @keyframes fadeSlideIn {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes softPulse {
        0%,
        100% {
          box-shadow: 0 0 0 0 rgba(184, 80, 66, 0.25);
        }
        50% {
          box-shadow: 0 0 0 6px rgba(184, 80, 66, 0);
        }
      }
      @keyframes drawLine {
        from {
          transform: scaleY(0);
        }
        to {
          transform: scaleY(1);
        }
      }

      @media (prefers-reduced-motion: reduce) {
        *,
        *::before,
        *::after {
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
        .btn:hover:not(:disabled),
        .card-interactive:hover {
          transform: none !important;
        }
      }
    `}</style>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] || COLORS.muted;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.4,
        color: COLORS.white,
        background: color,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function Panel({
  children,
  accent,
  interactive,
  style,
  className,
}: {
  children: React.ReactNode;
  accent?: boolean;
  interactive?: boolean;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={[interactive ? "card-interactive" : "", className || ""].join(" ").trim()}
      style={{
        background: accent ? COLORS.sand : COLORS.white,
        border: accent ? "none" : `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: 22,
        boxShadow: accent ? "none" : SHADOW_SM,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
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

export const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  border: `1px solid #D9D2C3`,
  borderRadius: 8,
  fontFamily: FONT_BODY,
  color: COLORS.ink,
};
export const INPUT_CLASS = "input-field";

export const primaryButtonStyle = (disabled?: boolean): React.CSSProperties => ({
  padding: "10px 18px",
  fontSize: 13.5,
  fontWeight: 700,
  border: "none",
  borderRadius: 8,
  background: disabled ? COLORS.muted : COLORS.terracotta,
  color: COLORS.white,
  cursor: disabled ? "default" : "pointer",
});

export const secondaryButtonStyle: React.CSSProperties = {
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
export const BTN_CLASS = "btn";

const NAV_ITEMS = [
  { href: "/", label: "Reasoning View" },
  { href: "/vendors", label: "Vendors" },
  { href: "/orders", label: "Orders" },
  { href: "/inventory", label: "Inventory" },
  { href: "/demo", label: "Demo Controls" },
];

export function NavBar() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const el = linkRefs.current[pathname];
    const container = containerRef.current;
    if (el && container) {
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setIndicator({ left: elRect.left - containerRect.left, width: elRect.width });
    }
  }, [pathname]);

  return (
    <div style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.white }}>
      <div
        ref={containerRef}
        style={{
          maxWidth: 1180,
          margin: "0 auto",
          padding: "0 32px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          height: 56,
          position: "relative",
        }}
      >
        <span
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 700,
            fontSize: 15,
            color: COLORS.ink,
            marginRight: 24,
          }}
        >
          Procurement Co-Pilot
        </span>
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              ref={(el) => {
                linkRefs.current[item.href] = el;
              }}
              style={{
                padding: "8px 14px",
                fontSize: 13.5,
                fontWeight: active ? 700 : 500,
                color: active ? COLORS.terracotta : COLORS.muted,
                textDecoration: "none",
                transition: `color 0.15s ${EASE_FAST}`,
              }}
            >
              {item.label}
            </Link>
          );
        })}
        {indicator && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: indicator.left,
              width: indicator.width,
              height: 2,
              background: COLORS.terracotta,
              transition: `left 0.3s ${EASE}, width 0.3s ${EASE}`,
            }}
          />
        )}
      </div>
    </div>
  );
}

export function PageHeader({ kicker, title, description }: { kicker: string; title: string; description?: string }) {
  return (
    <div style={{ marginBottom: 32, animation: "fadeSlideIn 0.5s " + EASE + " both" }}>
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
        {kicker}
      </div>
      <h1 style={{ fontFamily: FONT_DISPLAY, fontSize: 32, fontWeight: 700, color: COLORS.ink, margin: 0, letterSpacing: -0.3 }}>
        {title}
      </h1>
      {description && (
        <p style={{ color: COLORS.muted, fontSize: 14.5, marginTop: 8, maxWidth: 620, lineHeight: 1.5 }}>{description}</p>
      )}
    </div>
  );
}

export function LoadingRow({ label }: { label?: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: COLORS.muted, fontSize: 14 }}>
      {label || "Loading..."}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: "#FBEAE7",
        border: `1px solid ${COLORS.terracotta}`,
        fontSize: 13.5,
        color: COLORS.ink,
        lineHeight: 1.5,
        animation: "fadeSlideIn 0.3s " + EASE + " both",
      }}
    >
      {message}
    </div>
  );
}

export function EmptyRow({ message }: { message: string }) {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: COLORS.muted, fontSize: 14, fontStyle: "italic" }}>
      {message}
    </div>
  );
}
