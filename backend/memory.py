"""
Memory layer for the Procurement Co-Pilot agent.

This is the agent's persistent memory: vendor reliability, price history,
past orders, and a full step-by-step trace of every agent run. SQLite is
used deliberately over a vector DB, since this data is structured
(vendors, prices, reliability scores), not free text needing semantic
search. This satisfies the hackathon track's memory requirement through
session/user-profile-style persistence rather than embedding retrieval.

Nothing in this file talks to the LLM API (Groq). It only reads and writes
the DB, which keeps it trivially testable on its own.
"""

import sqlite3
import time
import json
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).parent / "mess_agent.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,       -- vegetables | groceries | gas
    reliability_score REAL NOT NULL DEFAULT 0.8,  -- 0.0 to 1.0
    is_available INTEGER NOT NULL DEFAULT 1,      -- flipped to 0 for demo failure
    fail_next_order INTEGER NOT NULL DEFAULT 0,   -- simulates order-time rejection even if "available"
    notes TEXT
);

CREATE TABLE IF NOT EXISTS inventory (
    item TEXT PRIMARY KEY,
    quantity_on_hand REAL NOT NULL,
    unit TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS price_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    price REAL NOT NULL,          -- INR per unit
    unit TEXT NOT NULL,           -- kg, litre, cylinder, etc.
    max_available REAL,           -- NULL = unlimited; otherwise vendor's stock cap for this item
    recorded_at REAL NOT NULL,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    quantity REAL NOT NULL,           -- originally requested
    quantity_fulfilled REAL NOT NULL, -- actually fulfilled (less than quantity if partial)
    unit TEXT NOT NULL,
    price REAL NOT NULL,
    total_spent REAL NOT NULL,        -- price * quantity_fulfilled
    status TEXT NOT NULL,             -- placed | partial | failed | rejected | needs_approval | over_budget | exceeds_shortage
    run_id INTEGER,
    placed_at REAL NOT NULL,
    FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

CREATE TABLE IF NOT EXISTS agent_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    objective TEXT NOT NULL,
    budget REAL,                  -- NULL = no run-level budget enforced (e.g. ad-hoc /agent/run tests)
    status TEXT NOT NULL DEFAULT 'running',  -- running | complete | failed
    started_at REAL NOT NULL,
    finished_at REAL
);

CREATE TABLE IF NOT EXISTS run_shortage (
    run_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    PRIMARY KEY (run_id, item)
);

CREATE TABLE IF NOT EXISTS agent_trace (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    step_number INTEGER NOT NULL,
    step_type TEXT NOT NULL,      -- plan | tool_call | tool_result | decision
    content TEXT NOT NULL,        -- JSON-encoded payload
    created_at REAL NOT NULL,
    FOREIGN KEY (run_id) REFERENCES agent_runs(id)
);
"""


@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_conn() as conn:
        conn.executescript(SCHEMA)


# ---------- vendors & prices ----------

def get_vendors_for_item(item: str):
    """Return all vendors known to carry `item`, with latest price,
    capacity, and an explicit, inspectable score (not an LLM vibe
    judgment)."""
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT v.id, v.name, v.category, v.reliability_score, v.is_available, v.fail_next_order,
                   ph.price, ph.unit, ph.max_available
            FROM vendors v
            JOIN price_history ph ON ph.vendor_id = v.id
            WHERE ph.item = ?
              AND ph.id = (
                  SELECT id FROM price_history
                  WHERE vendor_id = v.id AND item = ?
                  ORDER BY recorded_at DESC LIMIT 1
              )
            ORDER BY ph.price ASC
            """,
            (item, item),
        ).fetchall()
        vendors = [dict(r) for r in rows]
        return score_vendors(vendors)


def score_vendors(vendors: list):
    """
    Explicit, documented vendor-selection policy: 60% weight on
    reliability, 40% weight on price (cheaper = better). This is
    deterministic and the same for every decision, so the agent's final
    choice can be checked against it, it's not just unexplained model
    output. The agent may still deviate (e.g. the top-scored vendor is
    unavailable), but the score is always visible in the tool result.

    Tiebreak policy, also explicit: on a tied score, prefer higher raw
    reliability, then alphabetical vendor name, so the outcome is fully
    deterministic and reproducible, never "whichever the model felt
    like."
    """
    if not vendors:
        return vendors
    prices = [v["price"] for v in vendors]
    lo, hi = min(prices), max(prices)
    for v in vendors:
        price_score = 1.0 if hi == lo else (hi - v["price"]) / (hi - lo)
        v["score"] = round(0.6 * v["reliability_score"] + 0.4 * price_score, 3)
    vendors.sort(key=lambda v: (-v["score"], -v["reliability_score"], v["name"]))
    if vendors:
        vendors[0]["recommended"] = True
    return vendors


def get_vendor_by_name(name: str):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM vendors WHERE name = ?", (name,)).fetchone()
        return dict(row) if row else None


def set_vendor_availability(name: str, available: bool):
    with get_conn() as conn:
        conn.execute(
            "UPDATE vendors SET is_available = ? WHERE name = ?",
            (1 if available else 0, name),
        )


def set_vendor_fail_next_order(name: str, should_fail: bool):
    """
    A second, more dramatic demo failure mode: the vendor LOOKS available
    (passes check_vendor_availability) but the order itself gets
    rejected when placed, e.g. simulating a delivery-time failure rather
    than an upfront one. The flag clears itself after firing once.
    """
    with get_conn() as conn:
        conn.execute(
            "UPDATE vendors SET fail_next_order = ? WHERE name = ?",
            (1 if should_fail else 0, name),
        )


def record_order(vendor_name: str, item: str, quantity: float, quantity_fulfilled: float,
                  unit: str, price: float, status: str, run_id: int):
    vendor = get_vendor_by_name(vendor_name)
    total_spent = round(price * quantity_fulfilled, 2)
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO orders (vendor_id, item, quantity, quantity_fulfilled, unit, price,
                                    total_spent, status, run_id, placed_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (vendor["id"] if vendor else None, item, quantity, quantity_fulfilled, unit, price,
             total_spent, status, run_id, time.time()),
        )


def adjust_reliability(vendor_name: str, delta: float) -> tuple:
    """Nudge a vendor's reliability score after an order succeeds or
    fails. Returns (before, after) so callers can prove, in the tool
    result itself, that memory actually changed as a consequence of
    this event, not just that a number exists somewhere."""
    vendor = get_vendor_by_name(vendor_name)
    before = vendor["reliability_score"] if vendor else None
    with get_conn() as conn:
        conn.execute(
            """UPDATE vendors SET reliability_score =
               MAX(0.0, MIN(1.0, reliability_score + ?)) WHERE name = ?""",
            (delta, vendor_name),
        )
    after = get_vendor_by_name(vendor_name)["reliability_score"]
    return (before, after)


# ---------- guardrails: shortage tracking, budget, duplicate/over-quantity prevention ----------

def save_run_shortage(run_id: int, shortage: dict):
    """Persist the deterministically-computed shortage list for this run,
    so place_order can validate requested quantities against it later,
    this is what makes duplicate-order and hallucinated-quantity
    prevention possible."""
    with get_conn() as conn:
        for item, info in shortage.items():
            conn.execute(
                "INSERT INTO run_shortage (run_id, item, quantity, unit) VALUES (?, ?, ?, ?)",
                (run_id, item, info["quantity"], info["unit"]),
            )


def get_shortage_quantity(run_id: int, item: str):
    """Returns None if this run has no tracked shortage for this item
    (e.g. an ad-hoc /agent/run test), meaning the guardrail is skipped
    rather than incorrectly blocking a legitimate manual test."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT quantity FROM run_shortage WHERE run_id = ? AND item = ?",
            (run_id, item),
        ).fetchone()
        return row["quantity"] if row else None


def get_cumulative_ordered(run_id: int, item: str) -> float:
    """Sum of everything successfully or partially fulfilled for this
    item in this run so far, used to block duplicate/over-quantity
    orders across multiple tool calls in the same run."""
    with get_conn() as conn:
        row = conn.execute(
            """SELECT COALESCE(SUM(quantity_fulfilled), 0) as total FROM orders
               WHERE run_id = ? AND item = ? AND status IN ('placed', 'partial')""",
            (run_id, item),
        ).fetchone()
        return row["total"]


def get_spent_so_far(run_id: int) -> float:
    with get_conn() as conn:
        row = conn.execute(
            """SELECT COALESCE(SUM(total_spent), 0) as total FROM orders
               WHERE run_id = ? AND status IN ('placed', 'partial')""",
            (run_id,),
        ).fetchone()
        return row["total"]


# ---------- runs & trace (this is what the frontend "reasoning view" reads) ----------

def start_run(objective: str, budget: float = None) -> int:
    with get_conn() as conn:
        cur = conn.execute(
            "INSERT INTO agent_runs (objective, budget, status, started_at) VALUES (?, ?, 'running', ?)",
            (objective, budget, time.time()),
        )
        return cur.lastrowid


def finish_run(run_id: int, status: str):
    with get_conn() as conn:
        conn.execute(
            "UPDATE agent_runs SET status = ?, finished_at = ? WHERE id = ?",
            (status, time.time(), run_id),
        )


def log_trace_step(run_id: int, step_number: int, step_type: str, content: dict):
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO agent_trace (run_id, step_number, step_type, content, created_at)
               VALUES (?, ?, ?, ?, ?)""",
            (run_id, step_number, step_type, json.dumps(content), time.time()),
        )


def get_trace(run_id: int):
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM agent_trace WHERE run_id = ? ORDER BY step_number ASC",
            (run_id,),
        ).fetchall()
        out = []
        for r in rows:
            d = dict(r)
            d["content"] = json.loads(d["content"])
            out.append(d)
        return out


def get_run(run_id: int):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM agent_runs WHERE id = ?", (run_id,)).fetchone()
        return dict(row) if row else None


def list_vendors():
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM vendors ORDER BY category, name").fetchall()
        return [dict(r) for r in rows]


def list_orders():
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT o.*, v.name as vendor_name FROM orders o
               LEFT JOIN vendors v ON v.id = o.vendor_id
               ORDER BY o.placed_at DESC"""
        ).fetchall()
        return [dict(r) for r in rows]
