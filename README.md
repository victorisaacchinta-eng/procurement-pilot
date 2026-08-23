# Procurement Co-Pilot: Starter Scaffold

Agent Hub Hackathon, Track 1. This is a working skeleton, not the final
product, it exists so everyone can start building against a real,
running system instead of an empty repo.

## Round 4: live-validated, plus the full frontend is built

**The agent core is no longer untested.** A real run against Groq with a
real key: 3-item shortage, ₹1,516.62 auto-computed budget, ₹1,333.20
spent, and the agent split one onion order across two vendors entirely on
its own after the first vendor's capacity ran out mid-run, nobody coded a
"split across vendors" branch. Full numbers in `resolved_cons_and_cracks.md`.

**The failure-recovery mode is confirmed too**, though it fired one run
earlier than expected due to a `uvicorn --reload` connection drop, caught
by searching `/orders` for `"status": "rejected"` and finding the real
rejection tied to the run that triggered it.

**Frontend went from a rough single page to five real pages:**
`/` (reasoning view), `/vendors`, `/orders`, `/inventory`, `/demo`
(one-click failure triggers, no more hand-typed JSON in Swagger). All
five share one design system (`lib/ui.tsx`) so they read as one product.
Full production build compiles clean across all routes.

## Round 3: switched from Anthropic to Groq

The agent core now runs on Groq (`openai/gpt-oss-120b`) instead of the
Anthropic API. Groq's free tier needs no credit card, unlike the
Anthropic blocker from earlier rounds, get a key at
console.groq.com/keys and you're unblocked immediately.

**What actually changed:** only `agent.py`'s wire format and
`tools.py`'s `TOOL_DEFINITIONS` schema. Groq's Chat Completions API is
OpenAI-compatible, structurally different from Anthropic's Messages
API:
- Tools are wrapped `{"type": "function", "function": {...}}`, not a
  flat `{name, description, input_schema}` object.
- One response has ONE assistant message with optional `.content` and
  `.tool_calls`, not a list of content blocks.
- Tool call arguments arrive as a JSON string, parsed with `json.loads`
  before use.
- Loop continues while `finish_reason == "tool_calls"`.

**What did NOT change:** every guardrail, the planning logic, the
memory schema, all of it is provider-agnostic and was re-tested
end to end after the switch, all guardrails pass identically.

**One model note:** Groq deprecated `llama-3.3-70b-versatile` and
`llama-3.1-8b-instant` on 2026-08-16. Don't use them if you see them in
older examples online, they may already be shut down. `openai/gpt-oss-120b`
is the current recommended model for agentic tool-use work, with
`openai/gpt-oss-20b` as a faster, cheaper alternative for repeated demo
runs during development.

Two rounds of team review have also happened. Full writeup of every
issue from both, resolved or explicitly scoped out, is in
`resolved_cons_and_cracks.md` at the repo root.

## Round 2: structural fixes, not just wording

The second review found the deepest flaw: the vendor selection logic
was a deterministic sort, an LLM wrapper around it wouldn't have
behaved any differently, which is exactly the "why do you need an
agent at all" objection judges will raise. Fixed with real code:

- **Run-level budget.** The whole shortage list shares one budget.
  Prices aren't known until queried, so the agent has to adapt online,
  not precompute a plan. `check_budget_status` is a real tool,
  backend-computed, the agent is never trusted to sum its own spend.
- **Vendor capacity + genuine partial fulfillment.** A vendor can now
  run short mid-order. Tested: a 10kg request against a 4kg cap returns
  a real `partial` result, the agent has to decide what to do about the
  remaining 6kg, not follow a script.
- **Deterministic tiebreak** in vendor scoring (reliability, then
  name), tested against an exact-score tie.
- **Duplicate/over-quantity guardrail.** Cumulative ordering per item
  per run can't exceed the computed shortage, one check blocks both
  duplicate orders and hallucinated quantities.
- **Memory now visibly proves itself.** Every order result carries
  `reliability_before`/`reliability_after`, so "memory changed a later
  decision" isn't an assertion, it's in the response.

## Round 1: foundation fixes (recap)

- Real `inventory` table, digital inventory as source of truth.
- Menu → shortage is deterministic backend arithmetic (`planning.py`),
  zero LLM math, ever.
- Explicit, inspectable vendor score (60% reliability / 40% price).
- Per-order spending limit (`needs_approval` above ₹2000).
- Two real failure modes (upfront unavailable, order-time rejection).
- Memory vs. execution log explicitly documented.
- Clean event labels for the frontend, no raw JSON dumps.

Full detail on all of the above is in `resolved_cons_and_cracks.md`.

## What's already built and tested

- **`backend/planning.py`**: deterministic menu, requirement,
  shortage calculation, plus the default budget estimator. Zero API
  calls. Tested independently.
- **`backend/memory.py`**: SQLite schema (vendors, inventory, price
  history with capacity, orders with fulfillment tracking, run
  shortage, agent trace) and access functions, including scoring with
  a deterministic tiebreak. Tested independently.
- **`backend/tools.py`**: four real tools (`check_vendor_prices`,
  `check_vendor_availability`, `check_budget_status`, `place_order`),
  plus every guardrail: per-order limit, run budget, capacity/partial
  fulfillment, and the shortage ceiling. Tested independently, all
  seven guardrail scenarios pass.
- **`backend/agent.py`**: the autonomous planning loop on Groq
  (`openai/gpt-oss-120b`), consumes a shortage list and a budget (never
  raw menu text), logs clean events. This is the only file that needs
  `GROQ_API_KEY` to run.
- **`backend/main.py`**: FastAPI app. `/kitchen/run-procurement` is
  the real demo entrypoint: menu, student count, and optional budget
  in; shortage computed; a sensible default budget applied if none is
  given; agent only runs if there's an actual shortage.
- **`frontend/`**: full Next.js dashboard, five pages, shared design
  system in `lib/ui.tsx`. `npm run build` compiles clean across every
  route.
  - `/` the reasoning view, chip-based menu input, live-run trigger,
    animated reasoning trail, budget bar
  - `/vendors` every vendor with a live reliability bar, availability
    status, and whether a rejection trap is currently armed
  - `/orders` full order history, filterable by run, color-coded status
    badges matching every guardrail outcome
  - `/inventory` current stock plus a form to simulate a stock-take
  - `/demo` one-click controls for both failure modes

## What's NOT done yet, on purpose

- **The five frontend pages haven't had a full manual click-through on
  a real browser yet.** The build compiles clean and Next's own static
  generation step rendered every route without a runtime error, that's
  real signal, but it's not the same as clicking every button by hand.
  Do that pass before demo day.
- No deployment config. Plan to run everything locally for the demo.
- Quantitative pain-point data, a real usability check on the frontend,
  and demo choreography rehearsal are still open, see the end of
  `resolved_cons_and_cracks.md` for the full priority list.

## Setup

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# edit .env, paste in a real key from console.groq.com/keys (free, no card needed)
python3 seed_data.py
uvicorn main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` for the full interactive API contract.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Visit `http://localhost:3000`.

### 3. Try the demo flow

```bash
# No shortage, agent never runs:
curl -X POST http://localhost:8000/kitchen/run-procurement \
  -H "Content-Type: application/json" \
  -d '{"menu": ["plain rice"], "student_count": 10}'

# Real shortage, agent runs, default budget auto-computed:
curl -X POST http://localhost:8000/kitchen/run-procurement \
  -H "Content-Type: application/json" \
  -d '{"menu": ["onion curry", "tomato dal"], "student_count": 120}'

# Same, but with an explicit tight budget to force real trade-offs:
curl -X POST http://localhost:8000/kitchen/run-procurement \
  -H "Content-Type: application/json" \
  -d '{"menu": ["onion curry", "tomato dal"], "student_count": 120, "budget": 500}'
```

To rehearse the live failure moment, before the run above:

```bash
# Mode 1: vendor flagged unavailable upfront
curl -X POST http://localhost:8000/demo/set-vendor-availability \
  -H "Content-Type: application/json" \
  -d '{"vendor_name": "Hyderabad Mandi Direct", "available": false}'

# Mode 2: vendor looks fine, order gets rejected anyway (fires once)
curl -X POST http://localhost:8000/demo/fail-next-order \
  -H "Content-Type: application/json" \
  -d '{"vendor_name": "Hyderabad Mandi Direct", "should_fail": true}'
```

Mode 3 (capacity-driven partial fulfillment) needs no demo trigger at
all, it's real data: Hyderabad Mandi Direct is seeded with only 4kg of
onion capacity, so any order requesting more than that against them
genuinely partially fulfills.

## Security, read this before pushing anything

- Never commit `.env` or `.env.local`, both are already gitignored.
- The API key only ever lives in the backend. The frontend never sees it
  directly, it only talks to your own FastAPI server.
- Don't hardcode the key into any file "temporarily to test it," that's
  exactly the mistake that gets vibe-coded hackathon projects compromised.

## Repo map

```
backend/
  planning.py     menu -> requirements -> shortage -> default budget, deterministic, no LLM
  memory.py       the Memory: schema, scoring with tiebreak, budget/shortage guardrail queries
  tools.py        the Hands: 4 tools, every guardrail, clean event labels
  agent.py        the Brain: consumes shortage + budget, logs clean events
  main.py         the API surface, /kitchen/run-procurement is the real demo path
  seed_data.py    mock Hyderabad vendor + inventory + capacity dataset, safe to re-run anytime
frontend/
  app/page.tsx    rough working reasoning view
  lib/api.ts      typed client for every backend endpoint
resolved_cons_and_cracks.md   full status of every issue from both team reviews
speaking_script.md            judge-ready spoken script, language issues fixed
```
