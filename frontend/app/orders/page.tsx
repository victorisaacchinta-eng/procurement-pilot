"use client";

import { useEffect, useMemo, useState } from "react";
import { getOrders, Order } from "../../lib/api";
import {
  COLORS,
  FONT_MONO,
  Panel,
  PageHeader,
  StatusBadge,
  LoadingRow,
  ErrorBox,
  EmptyRow,
  inputStyle,
} from "../../lib/ui";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runFilter, setRunFilter] = useState<string>("all");

  useEffect(() => {
    getOrders()
      .then(setOrders)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load orders."));
  }, []);

  const runIds = useMemo(() => {
    if (!orders) return [];
    return Array.from(new Set(orders.map((o) => o.run_id))).sort((a, b) => b - a);
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (runFilter === "all") return orders;
    return orders.filter((o) => String(o.run_id) === runFilter);
  }, [orders, runFilter]);

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 96px" }}>
      <PageHeader
        kicker="Execution Log"
        title="Orders"
        description="Every order the agent has ever attempted, across every run. Status shows exactly which guardrail fired, if any, this is what an evaluator checks to confirm nothing is scripted."
      />

      {orders && orders.length > 0 && (
        <div style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 12.5, color: COLORS.muted, fontWeight: 600 }}>Filter by run</label>
          <select
            value={runFilter}
            onChange={(e) => setRunFilter(e.target.value)}
            className="input-field"
            style={{ ...inputStyle, width: "auto", padding: "8px 10px" }}
          >
            <option value="all">All runs</option>
            {runIds.map((id) => (
              <option key={id} value={id}>
                Run #{id}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {!orders && !error && <LoadingRow label="Loading orders..." />}
      {orders && orders.length === 0 && <EmptyRow message="No orders placed yet. Run the agent from the reasoning view first." />}

      {filtered.length > 0 && (
        <Panel style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: COLORS.dark }}>
                {["Item", "Vendor", "Qty", "Fulfilled", "Price", "Spent", "Status", "Run"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      fontSize: 11.5,
                      fontWeight: 700,
                      letterSpacing: 0.6,
                      color: COLORS.white,
                      textTransform: "uppercase",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={o.id} className="table-row-hover" style={{ background: i % 2 === 0 ? COLORS.white : COLORS.bg }}>
                  <td style={cellStyle}>{o.item}</td>
                  <td style={cellStyle}>{o.vendor_name}</td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO }}>
                    {o.quantity}
                    {o.unit}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO }}>
                    {o.quantity_fulfilled}
                    {o.unit}
                  </td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO }}>{"\u20b9"}{o.price}</td>
                  <td style={{ ...cellStyle, fontFamily: FONT_MONO, fontWeight: 700 }}>
                    {"\u20b9"}{o.total_spent.toFixed(2)}
                  </td>
                  <td style={cellStyle}>
                    <StatusBadge status={o.status} />
                  </td>
                  <td style={{ ...cellStyle, color: COLORS.muted }}>#{o.run_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </main>
  );
}

const cellStyle: React.CSSProperties = {
  padding: "11px 14px",
  fontSize: 13.5,
  color: COLORS.ink,
  borderTop: `1px solid ${COLORS.border}`,
};
