# Procurement Pilot

**An autonomous AI agent that runs vegetable, grocery, and gas procurement
for institutional kitchens, checking real vendor prices, enforcing a hard
budget, and recovering on its own when a vendor fails.**

🏆 **First Place Overall**, LaunchPad X, National Innovation Hackathon 2026,
organized by VetriaAI in partnership with Sreenidhi Institute of Science
and Technology (SNIST), Hyderabad. Built for Track 1, The Agent Hub.

---

## The problem

Hostel and college mess kitchens manage procurement almost entirely by
phone and memory: call a known vendor, hope they have stock, hope the
price is fair, and scramble if they say no. There's no system that
compares vendor prices and reliability in real time, and no automatic
recovery plan when a trusted vendor fails to deliver.

## What this does

Given tonight's menu and student count, the agent:
1. Calculates exactly what's short against current inventory (deterministic, no AI)
2. Checks real vendor prices and reliability scores
3. Places orders within a hard budget it cannot override
4. Reacts on its own if a vendor fails, rejects an order, or runs short mid-order

## Proof from real runs

In a real run against the live model:
- Budget assigned: **₹1,516.62** · Spent: **₹1,333.20**, fully within budget
- The agent's top-scored vendor for onions could only supply 4kg of a
  7.6kg order before hitting its capacity limit. **Nobody coded a "split
  across vendors" branch.** The agent read that limit off a real tool
  call and sourced the remaining 3.6kg from a second vendor on its own.
- Forced a vendor to reject an order outright. Confirmed in the order
  history: the agent recovered by selecting an alternative vendor in the
  same run, with no human input.

## Architecture

| Layer | What it does | Where |
|---|---|---|
| **Planning** | Menu → ingredient requirement → shortage, pure deterministic math, zero AI calls | `backend/planning.py` |
| **Agent core** | The reasoning loop: decides what to check and when, never touches arithmetic | `backend/agent.py` (Groq, `openai/gpt-oss-120b`) |
| **Tools** | Four real actions the agent can take: check price, check availability, check budget, place order | `backend/tools.py` |
| **Guardrails** | Budget caps, a ₹2,000 approval threshold, and a shortage ceiling, all enforced in backend code, not by asking the model nicely | `backend/tools.py` |
| **Memory** | Vendor reliability and price history, persists and updates after every order | `backend/memory.py` (SQLite) |
| **Dashboard** | Five pages: live reasoning view, vendors, orders, inventory, and one-click demo controls | `frontend/` (Next.js) |

The vendor score itself is a weighted formula, 60% reliability, 40% price,
the same methodology real procurement teams use, just sized for two
inputs instead of a dozen because that's what a same-day retail purchase
actually has. The model never computes this score, it's deterministic
Python; the agent only ever receives an already-ranked vendor list.

## Tech stack

- **Backend:** Python, FastAPI, SQLite
- **Agent:** Groq (`openai/gpt-oss-120b`)
- **Frontend:** Next.js, React, TypeScript
- **Deployment:** Render (backend), Vercel or GitHub Pages (frontend/static pages)

## Running it locally

```bash
# Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add your GROQ_API_KEY
python3 seed_data.py
uvicorn main:app --reload --port 8000

# Frontend, in a second terminal
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000`. Full API contract at `http://localhost:8000/docs`.

## The pitch materials

- `/docs`: the live scorecard, technical handoff, and pitch pages
  (see below for links once published via GitHub Pages)

## What's still open

- A hard, agent-independent budget cap the model cannot reason its way
  around (currently enforced but worth a second, model-blind layer)
- An automated evaluation suite, so "the agent chose correctly" is a
  test result, not a manual check
- Real pilot usage with an actual kitchen
- A security and multi-tenant review before a second kitchen onboards

Built by the Computer Science and Engineering team at ACE Engineering College.
