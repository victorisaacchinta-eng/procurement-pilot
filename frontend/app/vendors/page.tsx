"use client";

import { useEffect, useState } from "react";
import { getVendors, Vendor } from "../../lib/api";
import { COLORS, FONT_MONO, Panel, PageHeader, LoadingRow, ErrorBox, EmptyRow } from "../../lib/ui";

const CATEGORY_LABEL: Record<string, string> = {
  vegetables: "Vegetables",
  groceries: "Groceries",
  gas: "Gas",
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await getVendors();
      setVendors(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load vendors.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = vendors
    ? vendors.reduce<Record<string, Vendor[]>>((acc, v) => {
        (acc[v.category] ||= []).push(v);
        return acc;
      }, {})
    : null;

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 96px" }}>
      <PageHeader
        kicker="Memory"
        title="Vendors"
        description="Every vendor the agent can choose from, with the reliability score that persists and changes future decisions. This is the memory the track requirement asks for, not just a static list."
      />

      {error && <ErrorBox message={error} />}
      {!vendors && !error && <LoadingRow label="Loading vendors..." />}
      {vendors && vendors.length === 0 && <EmptyRow message="No vendors seeded yet. Run seed_data.py on the backend." />}

      {grouped &&
        Object.entries(grouped).map(([category, list]) => (
          <div key={category} style={{ marginBottom: 32 }}>
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
              {CATEGORY_LABEL[category] || category}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {list.map((v) => (
                <VendorCard key={v.id} vendor={v} />
              ))}
            </div>
          </div>
        ))}
    </main>
  );
}

function VendorCard({ vendor }: { vendor: Vendor }) {
  const pct = Math.round(vendor.reliability_score * 100);
  const barColor = pct >= 85 ? COLORS.green : pct >= 65 ? COLORS.terracotta : COLORS.muted;
  return (
    <Panel interactive>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink }}>{vendor.name}</span>
        <AvailabilityDot available={!!vendor.is_available} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Reliability
        </span>
        <span style={{ fontSize: 12.5, fontFamily: FONT_MONO, color: COLORS.ink }}>{pct}%</span>
      </div>
      <div style={{ height: 8, background: COLORS.sand, borderRadius: 999, overflow: "hidden", marginBottom: 12 }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 999 }} />
      </div>

      {!!vendor.fail_next_order && (
        <div
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            color: COLORS.white,
            background: COLORS.terracotta,
            display: "inline-block",
            padding: "3px 9px",
            borderRadius: 999,
          }}
        >
          Armed to reject next order
        </div>
      )}
    </Panel>
  );
}

function AvailabilityDot({ available }: { available: boolean }) {
  return (
    <span
      title={available ? "Available" : "Unavailable"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11.5,
        color: available ? COLORS.green : COLORS.muted,
        fontWeight: 600,
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: available ? COLORS.green : "#C9BFA8",
        }}
      />
      {available ? "Available" : "Unavailable"}
    </span>
  );
}
