# Procurement Pilot

An AI agent that handles vegetable, grocery and gas buying for institutional kitchens. It checks vendor prices,
stays inside a hard budget, and finds another vendor on its own when one fails.

We built it for Track 1 (The Agent Hub) at LaunchPad X, the National Innovation Hackathon 2026, organised by VetriaAI
with Sreenidhi Institute of Science and Technology (SNIST), Hyderabad. It won First Place Overall.

Hostel and college mess kitchens mostly buy by phone and memory: call a known vendor, hope they have stock at a fair
price, and scramble if they say no. There is no fallback when a trusted vendor does not deliver.

## What it does

Given tonight's menu and student count, the backend works out what is short against current inventory (plain
arithmetic, no AI). Only that shortage list goes to the agent, which then checks vendor prices and reliability, places
orders within the budget, and reacts if a vendor fails, rejects an order or runs short mid-order.

In one run against the live model the budget was ₹1,516.62 and the agent spent ₹1,333.20. Its top-scored vendor for
onions could only supply 4kg of a 7.6kg order. There is no "split across vendors" branch in the code; the agent read
the capacity limit from a tool result and bought the remaining 3.6kg from a second vendor. We also forced a vendor to
reject an order outright, and the order history shows the agent picked another vendor in the same run with no human
input.

## How it is built

| Part | What it does | Where |
|---|---|---|
| Planning | Menu to ingredient requirement to shortage, deterministic, no model calls | `backend/planning.py` |
| Agent loop | Decides what to check and when; never does the arithmetic | `backend/agent.py` (Groq, `openai/gpt-oss-120b`) |
| Tools | Check price, check availability, check budget, place order | `backend/tools.py` |
| Guardrails | Run budget, a ₹2,000 single-order approval limit and a shortage ceiling, enforced in backend code | `backend/tools.py` |
| Memory | Vendor reliability and price history, updated after every order | `backend/memory.py` (SQLite) |
| Dashboard | Reasoning view, vendors, orders, inventory and demo controls | `frontend/` (Next.js) |

The vendor score is 60% reliability and 40% price, computed in Python. The model never calculates it; the agent only
gets a list that is already ranked. If no budget is given, the default is the cheapest known price for each short
item plus 15%, which is tight enough that always picking the most reliable vendor will often go over.

## Run it locally

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GROQ_API_KEY
uvicorn main:app --reload --port 8000

# frontend, in a second terminal
cd frontend
npm install
npm run dev
```

Then open http://localhost:3000 (API docs at http://localhost:8000/docs). The backend seeds the mock vendor
data on startup if the database has no vendors; `python3 seed_data.py` or `GET /admin/seed` reseeds it by hand. All
vendor names, prices and reliability scores are invented for the demo.

The `docs/` folder has static pitch pages (a pitch and a self-graded scorecard) meant for GitHub Pages.

## Still open

- A second, model-blind budget cap the agent cannot reason its way around
- An automated evaluation suite, so "the agent chose correctly" is a test result and not a manual check
- Real pilot use with an actual kitchen
- A security and multi-tenant review before a second kitchen comes on

Built by the CSE team at ACE Engineering College.
