// Thin client for the FastAPI backend. Every function here maps to one
// endpoint in backend/main.py. Full contract is browsable at
// http://localhost:8000/docs while the backend is running.
//
// Types follow the SQL schema in memory.py, so fields like fail_next_order,
// quantity_fulfilled and total_spent are included even when a sample
// response does not show them.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export type TraceStep = {
  id: number;
  run_id: number;
  step_number: number;
  step_type: "plan" | "tool_call" | "tool_result" | "decision";
  content: Record<string, unknown> & { event?: string };
  created_at: number;
};

export type AgentRunResult = {
  run_id: number;
  objective: string;
  summary: string;
  trace: TraceStep[];
};

export type Vendor = {
  id: number;
  name: string;
  category: string;
  reliability_score: number;
  is_available: number;
  fail_next_order: number;
  notes: string | null;
};

// order.status can be: placed | partial | failed | rejected |
// needs_approval | over_budget | exceeds_shortage
export type Order = {
  id: number;
  vendor_id: number;
  vendor_name: string;
  item: string;
  quantity: number;
  quantity_fulfilled: number;
  unit: string;
  price: number;
  total_spent: number;
  status: string;
  run_id: number;
  placed_at: number;
};

// GET /inventory returns a dict keyed by item name, not an array.
export type InventoryMap = Record<string, { quantity: number; unit: string }>;

export type AgentRun = {
  id: number;
  objective: string;
  budget: number | null;
  status: string;
  started_at: number;
  finished_at: number | null;
};

export type TraceResponse = {
  run: AgentRun;
  trace: TraceStep[];
};

export type KitchenRunResult = AgentRunResult & {
  shortage?: Record<string, { quantity: number; unit: string }>;
  requirements?: Record<string, { quantity: number; unit: string }>;
  status?: "no_action_needed";
  message?: string;
  budget?: number;
  spent?: number;
};

export async function runAgent(objective: string): Promise<AgentRunResult> {
  const res = await fetch(`${API_URL}/agent/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ objective }),
  });
  if (!res.ok) throw new Error(`Agent run failed: ${res.status}`);
  return res.json();
}

export async function runKitchenProcurement(
  menu: string[],
  studentCount: number,
  budget?: number
): Promise<KitchenRunResult> {
  const res = await fetch(`${API_URL}/kitchen/run-procurement`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ menu, student_count: studentCount, budget }),
  });
  if (!res.ok) throw new Error(`Kitchen run failed: ${res.status}`);
  return res.json();
}

export async function getTrace(runId: number): Promise<TraceResponse> {
  const res = await fetch(`${API_URL}/agent/trace/${runId}`);
  if (!res.ok) throw new Error(`Failed to load trace for run ${runId}`);
  return res.json();
}

export async function getVendors(): Promise<Vendor[]> {
  const res = await fetch(`${API_URL}/vendors`);
  if (!res.ok) throw new Error("Failed to load vendors");
  return res.json();
}

export async function getOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/orders`);
  if (!res.ok) throw new Error("Failed to load orders");
  return res.json();
}

export async function getInventory(): Promise<InventoryMap> {
  const res = await fetch(`${API_URL}/inventory`);
  if (!res.ok) throw new Error("Failed to load inventory");
  return res.json();
}

export async function setInventory(item: string, quantity: number, unit: string) {
  const res = await fetch(`${API_URL}/inventory/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item, quantity, unit }),
  });
  if (!res.ok) throw new Error("Failed to update inventory");
  return res.json();
}

export async function setVendorAvailability(vendorName: string, available: boolean) {
  const res = await fetch(`${API_URL}/demo/set-vendor-availability`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vendor_name: vendorName, available }),
  });
  if (!res.ok) throw new Error("Failed to set vendor availability");
  return res.json();
}

export async function setFailNextOrder(vendorName: string, shouldFail: boolean) {
  const res = await fetch(`${API_URL}/demo/fail-next-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vendor_name: vendorName, should_fail: shouldFail }),
  });
  if (!res.ok) throw new Error("Failed to set fail-next-order");
  return res.json();
}
