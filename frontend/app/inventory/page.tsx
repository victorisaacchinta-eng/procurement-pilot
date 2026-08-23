"use client";

import { useEffect, useState } from "react";
import { getInventory, setInventory, InventoryMap } from "../../lib/api";
import {
  COLORS,
  FONT_MONO,
  Panel,
  PageHeader,
  FieldLabel,
  LoadingRow,
  ErrorBox,
  EmptyRow,
  inputStyle,
  primaryButtonStyle,
} from "../../lib/ui";

export default function InventoryPage() {
  const [inventory, setInventoryState] = useState<InventoryMap | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [item, setItem] = useState("");
  const [quantity, setQuantity] = useState(0);
  const [unit, setUnit] = useState("kg");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const data = await getInventory();
      setInventoryState(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load inventory.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave() {
    if (!item.trim()) {
      setError("Name the item before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    setSavedMsg(null);
    try {
      await setInventory(item.trim(), quantity, unit);
      setSavedMsg(`${item} updated to ${quantity}${unit}.`);
      setItem("");
      setQuantity(0);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the update.");
    } finally {
      setSaving(false);
    }
  }

  const rows = inventory ? Object.entries(inventory) : [];

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 96px" }}>
      <PageHeader
        kicker="Source of Truth"
        title="Inventory"
        description="Digital inventory is what the backend trusts to compute tonight's shortage. Update it here to simulate a stock-take, the same way mess staff would in a real kitchen."
      />

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 32 }} className="inv-grid">
        <Panel>
          <FieldLabel>Item name</FieldLabel>
          <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. onions" className="input-field" style={inputStyle} />

          <div style={{ height: 16 }} />

          <FieldLabel>Quantity on hand</FieldLabel>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="input-field"
            style={inputStyle}
            min={0}
          />

          <div style={{ height: 16 }} />

          <FieldLabel>Unit</FieldLabel>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="kg, litre, cylinder" className="input-field" style={inputStyle} />

          <div style={{ height: 20 }} />

          <button onClick={handleSave} disabled={saving} className="btn" style={{ ...primaryButtonStyle(saving), width: "100%" }}>
            {saving ? "Saving..." : "Update inventory"}
          </button>

          {savedMsg && (
            <p style={{ fontSize: 12.5, color: COLORS.green, marginTop: 10, fontWeight: 600 }}>{savedMsg}</p>
          )}
          {error && (
            <div style={{ marginTop: 14 }}>
              <ErrorBox message={error} />
            </div>
          )}
        </Panel>

        <div>
          {!inventory && !error && <LoadingRow label="Loading inventory..." />}
          {inventory && rows.length === 0 && <EmptyRow message="No inventory rows yet, add one on the left." />}
          {rows.length > 0 && (
            <Panel style={{ padding: 0, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: COLORS.dark }}>
                    {["Item", "On Hand"].map((h) => (
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
                  {rows.map(([name, info], i) => (
                    <tr key={name} className="table-row-hover" style={{ background: i % 2 === 0 ? COLORS.white : COLORS.bg }}>
                      <td style={{ padding: "11px 14px", fontSize: 13.5, color: COLORS.ink, borderTop: `1px solid ${COLORS.border}`, textTransform: "capitalize" }}>
                        {name}
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 13.5, fontFamily: FONT_MONO, color: COLORS.ink, borderTop: `1px solid ${COLORS.border}` }}>
                        {info.quantity} {info.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 860px) {
          .inv-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  );
}
