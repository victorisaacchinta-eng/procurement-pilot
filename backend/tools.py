"""
The tools the agent can call. Each one works against the SQLite memory
layer and is registered with Groq in agent.py. They can be tested
without an API key.

Guardrails, all enforced here rather than left to the model:
  - AUTO_APPROVE_LIMIT_INR: a single order at/above this needs a human.
  - Run-level budget: enforced in place_order against agent_runs.budget,
    computed from actual spend, not trusted from model arithmetic.
  - Vendor capacity: a vendor can only fill up to its stock cap for an
    item, so partial fills happen.
  - Shortage ceiling: total quantity ordered for an item in a run cannot
    exceed the computed shortage (plus a small rounding buffer). This one
    check blocks both duplicate orders and made-up quantities.
"""

import memory

AUTO_APPROVE_LIMIT_INR = 2000.0
SHORTAGE_BUFFER = 1.05  # allow 5% over the computed shortage for rounding, no more


def check_vendor_prices(item: str):
    """
    Look up every known vendor for an item, with current price, capacity,
    reliability and the computed score (see memory.score_vendors).
    """
    vendors = memory.get_vendors_for_item(item)
    if not vendors:
        return {"item": item, "vendors": [], "note": "No vendors found for this item."}
    return {"item": item, "vendors": vendors}


def check_vendor_availability(vendor_name: str):
    """
    Check whether a vendor can currently deliver. Returns "unavailable"
    when the demo failure is triggered. Only covers upfront unavailability:
    a vendor can pass this and still have its order rejected
    (fail_next_order) or partially filled (capacity), see place_order.
    """
    vendor = memory.get_vendor_by_name(vendor_name)
    if not vendor:
        return {"vendor": vendor_name, "available": False, "note": "Vendor not found."}
    return {
        "vendor": vendor_name,
        "available": bool(vendor["is_available"]),
        "reliability_score": vendor["reliability_score"],
    }


def check_budget_status(run_id: int):
    """
    Remaining budget for this run, computed from actual spend. The agent is
    not trusted to add up spend itself across turns.
    """
    run = memory.get_run(run_id)
    if not run or run.get("budget") is None:
        return {"budget": None, "spent": None, "remaining": None,
                "note": "No run-level budget is set for this run."}
    spent = memory.get_spent_so_far(run_id)
    return {
        "budget": run["budget"],
        "spent": round(spent, 2),
        "remaining": round(run["budget"] - spent, 2),
    }


def place_order(vendor_name: str, item: str, quantity: float, unit: str, run_id: int):
    """
    Place the order. Each outcome below is computed from current DB state
    and returned for the agent to react to:

      - exceeds_shortage: cumulative quantity for this item this run
        would exceed the computed shortage. Blocks both duplicate orders
        and hallucinated quantities with one check.
      - failed: vendor was already flagged unavailable upfront.
      - needs_approval: single order total >= AUTO_APPROVE_LIMIT_INR.
        The agent cannot self-approve past this.
      - over_budget: this order would push the run's total spend past
        its budget. Also non-negotiable, not advisory.
      - rejected: vendor looked available but the order itself was
        rejected (simulated delivery-time failure), reliability drops.
      - partial: vendor's stock cap is below the requested quantity,
        fulfills what it can, the agent must decide what to do about
        the rest (try another vendor, accept the shortfall, etc).
      - placed: succeeded in full, reliability nudges up slightly.
    """
    vendor = memory.get_vendor_by_name(vendor_name)
    if not vendor:
        return {"status": "failed", "reason": f"Unknown vendor: {vendor_name}"}

    shortage_qty = memory.get_shortage_quantity(run_id, item)
    if shortage_qty is not None:
        already = memory.get_cumulative_ordered(run_id, item)
        if already + quantity > shortage_qty * SHORTAGE_BUFFER:
            return {
                "status": "exceeds_shortage",
                "reason": (f"Requested {quantity}{unit} would bring total ordered for {item} "
                           f"to {round(already + quantity, 2)}{unit}, exceeding the computed "
                           f"shortage of {shortage_qty}{unit}. Refusing, to prevent duplicate "
                           f"or over-ordering."),
            }

    if not vendor["is_available"]:
        memory.record_order(vendor_name, item, quantity, 0.0, unit, 0.0, "failed", run_id)
        return {"status": "failed", "reason": f"{vendor_name} is not available right now."}

    vendors_for_item = memory.get_vendors_for_item(item)
    price_row = next((v for v in vendors_for_item if v["name"] == vendor_name), None)
    price = price_row["price"] if price_row else 0.0
    max_available = price_row["max_available"] if price_row else None

    fulfillable_qty = quantity if max_available is None else min(quantity, max_available)
    total = round(price * fulfillable_qty, 2)

    if total >= AUTO_APPROVE_LIMIT_INR:
        memory.record_order(vendor_name, item, quantity, 0.0, unit, price, "needs_approval", run_id)
        return {
            "status": "needs_approval",
            "reason": f"Order total \u20b9{total} meets or exceeds the \u20b9{AUTO_APPROVE_LIMIT_INR} auto-approve limit.",
            "total": total,
        }

    run = memory.get_run(run_id)
    if run and run.get("budget") is not None:
        spent_so_far = memory.get_spent_so_far(run_id)
        if spent_so_far + total > run["budget"]:
            memory.record_order(vendor_name, item, quantity, 0.0, unit, price, "over_budget", run_id)
            return {
                "status": "over_budget",
                "reason": (f"This order (\u20b9{total}) would push total spend to "
                           f"\u20b9{round(spent_so_far + total, 2)}, over the \u20b9{run['budget']} "
                           f"run budget (\u20b9{round(run['budget'] - spent_so_far, 2)} remaining). "
                           f"Consider a cheaper vendor, a smaller quantity, or skip this item."),
            }

    if vendor["fail_next_order"]:
        memory.set_vendor_fail_next_order(vendor_name, False)
        memory.record_order(vendor_name, item, quantity, 0.0, unit, 0.0, "rejected", run_id)
        before, after = memory.adjust_reliability(vendor_name, -0.05)
        return {
            "status": "rejected",
            "reason": f"{vendor_name} accepted the request but rejected the order at confirmation (simulated delivery-time failure).",
            "reliability_before": before,
            "reliability_after": after,
        }

    if max_available is not None and quantity > max_available:
        memory.record_order(vendor_name, item, quantity, fulfillable_qty, unit, price, "partial", run_id)
        before, after = memory.adjust_reliability(vendor_name, -0.01)
        return {
            "status": "partial",
            "vendor": vendor_name,
            "item": item,
            "quantity_requested": quantity,
            "quantity_fulfilled": fulfillable_qty,
            "quantity_short": round(quantity - fulfillable_qty, 2),
            "unit": unit,
            "price": price,
            "total": total,
            "reliability_before": before,
            "reliability_after": after,
            "note": f"{vendor_name} only had {max_available}{unit} in stock. Remainder still needed elsewhere.",
        }

    memory.record_order(vendor_name, item, quantity, fulfillable_qty, unit, price, "placed", run_id)
    before, after = memory.adjust_reliability(vendor_name, +0.02)
    return {
        "status": "placed",
        "vendor": vendor_name,
        "item": item,
        "quantity": fulfillable_qty,
        "unit": unit,
        "price": price,
        "total": total,
        "reliability_before": before,
        "reliability_after": after,
    }


def describe_event(tool_name: str, phase: str, payload: dict) -> str:
    """
    Turn a raw tool call/result into one readable line for the frontend
    event timeline.
    """
    if tool_name == "check_vendor_prices":
        if phase == "call":
            return f"Checking vendor prices for {payload.get('item')}"
        vendors = payload.get("vendors", [])
        if not vendors:
            return f"No vendors found for {payload.get('item')}"
        top = vendors[0]
        return (f"Found {len(vendors)} vendor(s) for {payload.get('item')}. "
                f"Top-scored: {top['name']} (\u20b9{top['price']}/{top['unit']}, "
                f"reliability {top['reliability_score']}, score {top['score']})")

    if tool_name == "check_vendor_availability":
        if phase == "call":
            return f"Checking whether {payload.get('vendor_name')} can deliver"
        status = "available" if payload.get("available") else "NOT available"
        return f"{payload.get('vendor')} is {status}"

    if tool_name == "check_budget_status":
        if phase == "call":
            return "Checking remaining run budget"
        if payload.get("budget") is None:
            return "No run budget set"
        return f"Budget check: \u20b9{payload.get('spent')} spent of \u20b9{payload.get('budget')}, \u20b9{payload.get('remaining')} remaining"

    if tool_name == "place_order":
        if phase == "call":
            return f"Placing order: {payload.get('quantity')}{payload.get('unit')} {payload.get('item')} from {payload.get('vendor_name')}"
        status = payload.get("status")
        if status == "placed":
            return f"Order placed: \u20b9{payload.get('total')} total (vendor reliability {payload.get('reliability_before')} \u2192 {payload.get('reliability_after')})"
        if status == "partial":
            return (f"Partial fulfillment: got {payload.get('quantity_fulfilled')}{payload.get('unit')} of "
                    f"{payload.get('quantity_requested')}{payload.get('unit')} requested, "
                    f"{payload.get('quantity_short')}{payload.get('unit')} short")
        if status == "needs_approval":
            return f"Order needs human approval: {payload.get('reason')}"
        if status == "over_budget":
            return f"Order blocked, over budget: {payload.get('reason')}"
        if status == "rejected":
            return f"Order rejected after acceptance: {payload.get('reason')} (reliability {payload.get('reliability_before')} \u2192 {payload.get('reliability_after')})"
        if status == "failed":
            return f"Order failed: {payload.get('reason')}"
        if status == "exceeds_shortage":
            return f"Order blocked: {payload.get('reason')}"
        return f"Order result: {status}"

    return f"{tool_name} ({phase})"


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "check_vendor_prices",
            "description": "Look up all known vendors for a given item, with current price, capacity, and reliability score. Always call this before deciding who to order from.",
            "parameters": {
                "type": "object",
                "properties": {
                    "item": {"type": "string", "description": "The item to check, e.g. 'onions', 'LPG cylinder'"}
                },
                "required": ["item"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_vendor_availability",
            "description": "Confirm whether a specific vendor can currently deliver, before placing an order with them.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_name": {"type": "string", "description": "The exact vendor name to check"}
                },
                "required": ["vendor_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_budget_status",
            "description": "Check how much of the run's total budget has been spent and how much remains. Call this before placing an order if you're unsure whether you have room left.",
            "parameters": {
                "type": "object",
                "properties": {
                    "run_id": {"type": "integer", "description": "The current run ID"}
                },
                "required": ["run_id"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "place_order",
            "description": "Place an order with a vendor. Only call this after confirming the vendor is available. May come back needs_approval, over_budget, partial, rejected, failed, or exceeds_shortage instead of succeeding, read the status and react accordingly.",
            "parameters": {
                "type": "object",
                "properties": {
                    "vendor_name": {"type": "string"},
                    "item": {"type": "string"},
                    "quantity": {"type": "number"},
                    "unit": {"type": "string", "description": "e.g. kg, litre, cylinder"},
                },
                "required": ["vendor_name", "item", "quantity", "unit"],
            },
        },
    },
]


def execute_tool(name: str, tool_input: dict, run_id: int):
    """Dispatch a tool call from the model to the matching Python function."""
    if name == "check_vendor_prices":
        return check_vendor_prices(tool_input["item"])
    if name == "check_vendor_availability":
        return check_vendor_availability(tool_input["vendor_name"])
    if name == "check_budget_status":
        return check_budget_status(run_id)
    if name == "place_order":
        return place_order(
            tool_input["vendor_name"],
            tool_input["item"],
            tool_input["quantity"],
            tool_input["unit"],
            run_id,
        )
    return {"error": f"Unknown tool: {name}"}
