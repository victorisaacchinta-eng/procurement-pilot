"""
Seeds the database with a MOCK vendor dataset for demo purposes.

None of these vendor names, prices, or reliability scores are real market
data, they're invented so the demo runs reliably on stage without
depending on any live scraped source. Run this once before your first
/agent/run:

    python seed_data.py
"""

import time
import memory

VENDORS = [
    # (name, category, reliability_score)
    ("Uppal Vegetable Traders", "vegetables", 0.92),
    ("Rajesh Fresh Produce", "vegetables", 0.78),
    ("Hyderabad Mandi Direct", "vegetables", 0.65),
    ("Sri Lakshmi Grocers", "groceries", 0.88),
    ("Balaji Wholesale Traders", "groceries", 0.71),
    ("Telangana Gas Agency", "gas", 0.95),
    ("Sri Balaji Gas Suppliers", "gas", 0.80),
]

# (vendor_name, item, price, unit, max_available)
# max_available=None means unlimited. Hyderabad Mandi Direct is deliberately
# capped low on onions, so a large-enough order genuinely triggers a partial
# fulfillment, not a scripted one, whatever quantity the agent asks for is
# checked against this cap for real.
PRICES = [
    ("Uppal Vegetable Traders", "onions", 32.0, "kg", None),
    ("Rajesh Fresh Produce", "onions", 28.0, "kg", None),
    ("Hyderabad Mandi Direct", "onions", 24.0, "kg", 4.0),
    ("Uppal Vegetable Traders", "tomatoes", 40.0, "kg", None),
    ("Rajesh Fresh Produce", "tomatoes", 36.0, "kg", None),
    ("Sri Lakshmi Grocers", "rice", 55.0, "kg", None),
    ("Balaji Wholesale Traders", "rice", 51.0, "kg", None),
    ("Sri Lakshmi Grocers", "toor dal", 145.0, "kg", None),
    ("Balaji Wholesale Traders", "toor dal", 138.0, "kg", None),
    ("Telangana Gas Agency", "LPG cylinder", 1100.0, "cylinder", None),
    ("Sri Balaji Gas Suppliers", "LPG cylinder", 1080.0, "cylinder", None),
]


# (item, quantity_on_hand, unit) — deliberately understocked on onions and
# toor dal so a shortage exists out of the box and the agent has real work
# to do the first time anyone runs the demo.
STARTING_INVENTORY = [
    ("onions", 2.0, "kg"),
    ("tomatoes", 3.0, "kg"),
    ("rice", 20.0, "kg"),
    ("toor dal", 1.0, "kg"),
]


def seed():
    memory.init_db()
    with memory.get_conn() as conn:
        conn.execute("DELETE FROM price_history")
        conn.execute("DELETE FROM vendors")
        conn.execute("DELETE FROM orders")
        conn.execute("DELETE FROM agent_trace")
        conn.execute("DELETE FROM agent_runs")
        conn.execute("DELETE FROM inventory")

        name_to_id = {}
        for name, category, reliability in VENDORS:
            cur = conn.execute(
                "INSERT INTO vendors (name, category, reliability_score, is_available, fail_next_order) VALUES (?, ?, ?, 1, 0)",
                (name, category, reliability),
            )
            name_to_id[name] = cur.lastrowid

        now = time.time()
        for vendor_name, item, price, unit, max_available in PRICES:
            conn.execute(
                "INSERT INTO price_history (vendor_id, item, price, unit, max_available, recorded_at) VALUES (?, ?, ?, ?, ?, ?)",
                (name_to_id[vendor_name], item, price, unit, max_available, now),
            )

        for item, qty, unit in STARTING_INVENTORY:
            conn.execute(
                "INSERT INTO inventory (item, quantity_on_hand, unit) VALUES (?, ?, ?)",
                (item, qty, unit),
            )

    print(f"Seeded {len(VENDORS)} vendors, {len(PRICES)} price entries, "
          f"{len(STARTING_INVENTORY)} inventory rows into {memory.DB_PATH}")


if __name__ == "__main__":
    seed()
