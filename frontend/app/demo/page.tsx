"use client";

import { useEffect, useState } from "react";
import { getVendors, setVendorAvailability, setFailNextOrder, Vendor } from "../../lib/api";
import {
  COLORS,
  Panel,
  PageHeader,
  FieldLabel,
  LoadingRow,
  ErrorBox,
  inputStyle,
  primaryButtonStyle,
} from "../../lib/ui";

export default function DemoPage() {
  const [vendors, setVendors] = useState<Vendor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyVendor, setBusyVendor] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function load() {
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

  async function toggleAvailability(v: Vendor) {
    setBusyVendor(v.name);
    setError(null);
    try {
      const nowAvailable = !v.is_available;
      await setVendorAvailability(v.name, nowAvailable);
      setLastAction(`${v.name} is now ${nowAvailable ? "available" : "unavailable"}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update availability.");
    } finally {
      setBusyVendor(null);
    }
  }

  async function armRejection(v: Vendor) {
    setBusyVendor(v.name);
    setError(null);
    try {
      await setFailNextOrder(v.name, true);
      setLastAction(`${v.name}'s next order will be rejected after acceptance. Fires once.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not arm the rejection.");
    } finally {
      setBusyVendor(null);
    }
  }

  async function disarmRejection(v: Vendor) {
    setBusyVendor(v.name);
    setError(null);
    try {
      await setFailNextOrder(v.name, false);
      setLastAction(`${v.name}'s rejection trap cleared.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not clear the rejection.");
    } finally {
      setBusyVendor(null);
    }
  }

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 32px 96px" }}>
      <PageHeader
        kicker="Demo Controls"
        title="Trigger a Failure Live"
        description="No more hand-typing JSON into Swagger before a run. Two real failure modes, one click each, then go run the agent from the Reasoning View."
      />

      {error && (
        <div style={{ marginBottom: 16 }}>
          <ErrorBox message={error} />
        </div>
      )}
      {lastAction && (
        <div
          style={{
            marginBottom: 20,
            padding: "12px 16px",
            borderRadius: 10,
            background: COLORS.sand,
            fontSize: 13.5,
            color: COLORS.ink,
          }}
        >
          {lastAction}
        </div>
      )}

      {!vendors && !error && <LoadingRow label="Loading vendors..." />}

      {vendors && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {vendors.map((v) => (
            <Panel key={v.id} interactive>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.ink, marginBottom: 4 }}>{v.name}</div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16, textTransform: "capitalize" }}>
                {v.category} &middot; reliability {(v.reliability_score * 100).toFixed(0)}%
              </div>

              <FieldLabel>Upfront availability</FieldLabel>
              <button
                onClick={() => toggleAvailability(v)}
                disabled={busyVendor === v.name}
                className="btn"
                style={{
                  ...primaryButtonStyle(busyVendor === v.name),
                  width: "100%",
                  background: v.is_available ? COLORS.muted : COLORS.green,
                  marginBottom: 16,
                }}
              >
                {v.is_available ? "Mark unavailable" : "Mark available again"}
              </button>

              <FieldLabel>Order-time rejection</FieldLabel>
              {v.fail_next_order ? (
                <button
                  onClick={() => disarmRejection(v)}
                  disabled={busyVendor === v.name}
                  className="btn"
                  style={{ ...primaryButtonStyle(busyVendor === v.name), width: "100%", background: COLORS.muted }}
                >
                  Armed, click to disarm
                </button>
              ) : (
                <button
                  onClick={() => armRejection(v)}
                  disabled={busyVendor === v.name}
                  className="btn"
                  style={{ ...primaryButtonStyle(busyVendor === v.name), width: "100%" }}
                >
                  Arm rejection (fires once)
                </button>
              )}
            </Panel>
          ))}
        </div>
      )}
    </main>
  );
}
