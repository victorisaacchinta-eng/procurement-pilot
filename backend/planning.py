"""
Deterministic backend logic: menu -> ingredient requirements -> shortage.

This entire file deliberately contains ZERO calls to any LLM API.
Per the foundation review: quantity math is backend arithmetic, not
something an LLM should be trusted to compute. The agent only ever sees
the OUTPUT of this file (a shortage list), never the raw menu or student
count. This keeps the boundary between deterministic backend logic and
agent reasoning explicit and inspectable.
"""

import memory

# Grams/kg or units required per student, per dish. Static for the demo,
# would come from a recipe database in a real system.
RECIPES = {
    "onion curry": {"onions": (0.08, "kg"), "tomatoes": (0.05, "kg")},
    "tomato dal": {"toor dal": (0.06, "kg"), "tomatoes": (0.04, "kg")},
    "plain rice": {"rice": (0.15, "kg")},
}


def calculate_requirements(menu_items: list[str], student_count: int) -> dict:
    """
    Pure arithmetic. Given tonight's menu and how many students are
    eating, return total ingredient quantities needed. No LLM involved,
    same inputs always produce the same outputs.
    """
    requirements: dict[str, dict] = {}
    for dish in menu_items:
        recipe = RECIPES.get(dish)
        if not recipe:
            continue
        for ingredient, (qty_per_student, unit) in recipe.items():
            needed = qty_per_student * student_count
            if ingredient in requirements:
                requirements[ingredient]["quantity"] += needed
            else:
                requirements[ingredient] = {"quantity": needed, "unit": unit}
    return requirements


def get_inventory() -> dict:
    """Current on-hand stock. Digital inventory is treated as the
    system's source of truth for this demo; we do not claim the agent
    physically senses stock."""
    with memory.get_conn() as conn:
        rows = conn.execute("SELECT item, quantity_on_hand, unit FROM inventory").fetchall()
        return {r["item"]: {"quantity": r["quantity_on_hand"], "unit": r["unit"]} for r in rows}


def calculate_shortage(requirements: dict, inventory: dict) -> dict:
    """Also pure arithmetic. Only ingredients where we don't have enough
    on hand come back, everything else is silently sufficient."""
    shortage = {}
    for item, req in requirements.items():
        on_hand = inventory.get(item, {"quantity": 0})["quantity"]
        gap = req["quantity"] - on_hand
        if gap > 0:
            shortage[item] = {"quantity": round(gap, 2), "unit": req["unit"]}
    return shortage


def set_inventory(item: str, quantity: float, unit: str):
    """Manual/simulated inventory update for the demo. In a real system
    this would come from a POS or stock-take integration."""
    with memory.get_conn() as conn:
        conn.execute(
            """INSERT INTO inventory (item, quantity_on_hand, unit) VALUES (?, ?, ?)
               ON CONFLICT(item) DO UPDATE SET quantity_on_hand = excluded.quantity_on_hand, unit = excluded.unit""",
            (item, quantity, unit),
        )


def estimate_default_budget(shortage: dict) -> float:
    """
    Default run budget when none is supplied: cheapest known vendor per
    item, summed, plus a 15% buffer. Deliberately tight, not generous,
    a plan that always reaches for the top-reliability (not cheapest)
    vendor for every item will often breach this, which is the point:
    it forces the agent to actually weigh reliability against price
    under a real constraint, not just default to "always pick the best
    reliability score" with no consequence.
    """
    total = 0.0
    for item, info in shortage.items():
        vendors = memory.get_vendors_for_item(item)
        if not vendors:
            continue
        cheapest = min(v["price"] for v in vendors)
        total += cheapest * info["quantity"]
    return round(total * 1.15, 2)
