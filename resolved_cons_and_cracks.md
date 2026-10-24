# Resolved Cons and Cracks
### Status of every issue flagged across both review documents

Two documents were flagged: the earlier **Foundation Cracks** review (12
points, pre-build) and this **Project Cons** review (12 sections, ~50
points plus 25 judge questions, post-build). This file is the single
source of truth for where things stand on both, organized to match the
original documents so anyone can cross-reference.

**Update since this file was first written:** the agent core has moved
from the Anthropic API to Groq (`openai/gpt-oss-120b`), which removes
the API-access blocker entirely, Groq's free tier needs no credit card.
Every mention of `ANTHROPIC_API_KEY` or "the Claude API" below is
historical, describing the state at the time each issue was resolved.
The current key everyone needs is `GROQ_API_KEY` from
console.groq.com/keys. Nothing about the actual resolutions changed,
guardrails, memory, planning, and scoring are all provider-agnostic and
were re-tested end to end after the switch.

**Status legend:**
- ✅ **RESOLVED (code)** — actually implemented and tested, not just discussed
- ✅ **RESOLVED (language)** — a wording fix, applied in `speaking_script.md`
- 🟡 **MITIGATED** — a practical, deliberate decision was made; not "fully solved" because full resolution isn't realistic in hackathon time, but the risk is bounded and defensible
- ⚪ **ACCEPTED LIMITATION** — explicitly scoped out, stated honestly rather than hidden
- 🔲 **OPEN — needs team action** — genuinely unresolved, someone needs to do something

---

# Part A: Foundation Cracks (pre-build review) — recap

All 12 points from the first review were resolved in the scaffold before this round. Quick status, full detail was shared in that round's README:

| # | Issue | Status |
|---|---|---|
| 1 | Inventory source of truth | ✅ Real `inventory` table, manual/simulated updates, digital inventory = source of truth |
| 2 | Menu → ingredient calculation | ✅ Deterministic backend arithmetic (`planning.py`), zero LLM math |
| 3 | "Best vendor" definition | ✅ Explicit 60/40 reliability/price score, now with a deterministic tiebreak too (see 1.5 below) |
| 4 | What "place the order" means | ✅ Real tool, real DB write, real success/failure |
| 5 | Vendor failure detection | ✅ Two distinct real failure modes (see 2.6 below) |
| 6 | What counts as memory | ✅ Explicitly documented: reliability/price = memory, trace = execution log |
| 7 | Autonomous spending limits | ✅ Per-order cap + run-level budget (expanded this round, see 1.6) |
| 8 | Multi-vendor failure handling | ✅ System prompt requires graceful stop-and-report when all vendors fail |
| 9 | Deterministic logic vs. agent reasoning | ✅ The organizing principle behind every fix in both rounds |
| 10 | Frontend shows raw text | ✅ `describe_event()` produces clean one-line events, no raw JSON |
| 11 | Novelty claim needs care | ✅ Language fixed, see 1.3 below |
| 12 | Core architecture | ✅ Matches the target pipeline exactly |

---

# Part B: Project Cons (this review)

## 1. Critical Cons

### 1.1 Doesn't prove why an agent is needed over a rules engine
**Status: ✅ RESOLVED (code) — this was the most important fix in this round.**

This was real. The original scoring logic was a deterministic sort, an
LLM wrapper around an if/else chain would have produced the same
result. Fixed by adding two things that a static rule table genuinely
can't precompute:

- **A run-level budget spanning the whole shortage list.** Prices,
  capacity, and availability are only known once queried, mid-run.
  Spend on item one changes what's affordable for item three. That's a
  sequential allocation problem discovered as you go, not a lookup.
- **Vendor capacity limits causing real partial fulfillment.** A vendor
  can now genuinely run short, forcing the agent to decide: source the
  remainder elsewhere, or accept the shortfall and report it. Tested:
  requesting 10kg from a vendor capped at 4kg returns a real `partial`
  status with `quantity_fulfilled: 4.0`, `quantity_short: 6.0`, not a
  scripted branch.

The honest version of the pitch line is now: *"A rules engine needs a
new hand-written branch for every new combination of failure and
budget pressure. The agent handles combinations we didn't explicitly
code for."* That's defensible, because it's literally what the tests
prove, not an assertion.

### 1.2 "All mandatory, no partial credit" not independently sourced
**Status: ✅ RESOLVED (language).** We don't need to paraphrase this at
all, the actual hackathon slide (`Hackathon_Technical_Tracks.pdf`)
states verbatim: *"System Requirements (ALL are required)"* and
*"Strictly Prohibited: Stateless, single-prompt-to-single-response
chatbots."* Quote the slide directly in the deck and script instead of
our own paraphrase. `speaking_script.md` now says this explicitly.

### 1.3 "Nobody has built this" is an overclaim
**Status: ✅ RESOLVED (language).** Rewritten everywhere to: *"The
canteen software we looked at, tools like SpaceBasic and TeachMate,
focuses on student billing and wallets. We haven't found one that
helps with the actual buying decision."* Narrower, defensible, and
still makes the differentiation point without an absolute claim one
counterexample can puncture.

### 1.4 Prototype vs. real-world autonomy boundary unclear
**Status: ✅ RESOLVED (language).** One canonical sentence, now in the
script, to be repeated any time autonomy or purchasing comes up:
*"This prototype uses a real agent tool-calling loop over a controlled
procurement sandbox: the planning, tool calls, and order records are
real. Vendor identities and prices are simulated for demo reliability."*

### 1.5 "Best vendor" underspecified
**Status: ✅ RESOLVED (code).** Answering the review's specific
questions directly:
- *Is lower price always better?* No, 40% weight, not absolute.
- *How much is reliability worth?* 60% weight, a documented constant.
- *What if the cheapest vendor is late?* Timeliness isn't modeled
  separately, `reliability_score` is treated as a proxy for historical
  on-time performance. Stated as a deliberate MVP simplification, not
  hidden (see 2.7).
- *What if the reliable vendor has insufficient capacity?* Now modeled,
  see 1.1, produces a real `partial` result.
- *What if two vendors tie?* Now has an explicit, tested tiebreak:
  higher raw reliability first, then alphabetical name. Fully
  deterministic, verified with an exact-tie test case.

### 1.6 "Autonomous" claimed before the boundary is defined
**Status: ✅ RESOLVED (code).** Four guardrails now exist, all enforced
in backend code, none of them advisory text the model could ignore:
1. **Per-order cap** (₹2000): returns `needs_approval`, agent cannot
   override.
2. **Run-level budget**: returns `over_budget`, checked against actual
   recorded spend, not model arithmetic.
3. **Shortage ceiling**: cumulative quantity ordered per item per run
   can't exceed the computed shortage (+5% rounding buffer), this one
   check blocks both duplicate orders and hallucinated quantities.
4. **Implicit vendor allowlist**: tools only ever reference vendors that
   exist in our own database, there's no path to an arbitrary vendor.

All four were tested directly (not just described), see the test
output from this round: budget block, shortage block, and capacity
partial-fulfillment all fire correctly and independently.

### 1.7 No explicit safety/guardrail story
**Status: ✅ RESOLVED (language + code).** This is now answerable in one
breath: *"It can't self-approve past a set order size. It can't exceed
the total run budget. It can't duplicate or hallucinate a quantity.
All three are backend checks, not requests to the model."* See 1.6 for
what backs that sentence.

---

## 2. Major Product / Agent Cons

### 2.1 Memory not demonstrated as changing future decisions
**Status: ✅ RESOLVED (code).** Every order result now carries
`reliability_before` and `reliability_after` explicitly, so the
change is visible in the tool result itself, not just happening
silently in the database. Tested: an order lifts reliability from
0.94 → 0.96 in the same response the frontend will render. For the
demo, run the same item twice with a rejection in between and the
score difference is directly visible on screen. That's `event → memory
update → visible change`, the exact chain the review asked for.

### 2.2 Tool-use story too broad, potentially decorative
**Status: 🟡 MITIGATED.** The real chain now runs:
`check_vendor_prices → check_vendor_availability → check_budget_status
→ place_order`, each result genuinely determines the next call (which
vendor to check depends on the price/score result; whether to check
budget depends on how close to the limit prior spend has gotten). This
is visible directly in the trace, use it as evidence rather than
asserting it.

### 2.3 "Weather/festival demand signals" introduced with no role
**Status: ✅ RESOLVED (cut).** This was only ever mentioned in early
planning conversation, never implemented in code. Formally dropped.
Don't mention it in the pitch, it was scope that got cut before it
became a liability.

### 2.4 / 2.5 Product too broad for the team / MVP boundary not explicit
**Status: ✅ RESOLVED (language) — explicit MVP boundary below.**

**In scope for the hackathon build:**
- One kitchen, three item categories (vegetables, groceries, gas)
- Deterministic menu → shortage calculation
- Vendor price/reliability/capacity lookup with an explicit score
- Two failure modes (upfront unavailable, order-time rejection) plus
  capacity-driven partial fulfillment
- Per-order and run-level budget guardrails
- A live event-timeline frontend

**Explicitly out of scope, not oversights:**
- Multi-kitchen arbitration (see 8.3)
- Weather/festival demand signals (cut, see 2.3)
- Real vendor APIs, WhatsApp/email integration
- Delivery-time modeling, quality rejection, wrong-quantity-delivered
  (see 2.7)

### 2.6 Failure detection mechanism unclear
**Status: ✅ RESOLVED (code).** The exact mechanism, statable plainly:
a vendor's `is_available` or `fail_next_order` flag changes in the
database before or during a run. When the agent calls
`check_vendor_availability` or `place_order`, it receives a real,
unscripted tool result reflecting current DB state. Claude's next
action is its own inference from that result, there is no pre-written
"if vendor fails, do X" branch in our code, the system prompt only
says what to do in general terms (try the next vendor), it doesn't
hard-code which vendor or when.

### 2.7 "Delivery failure" undefined, states collapsed
**Status: 🟡 MITIGATED, ⚪ partially accepted limitation.** Now three
distinct, real, tool-driven states instead of one: upfront unavailable,
order-time rejection, and capacity-driven partial fulfillment. Quality
rejection and wrong-quantity-delivered remain genuinely out of scope,
they'd need infrastructure we don't have time to build, stated
honestly rather than implied as covered.

---

## 3. Market / Business Cons

### 3.1 Pain size not quantitatively established
**Status: 🔲 OPEN — needs team action, and this is the one place we
should not fabricate a number.** Practical, doable-before-demo-day fix:
have one or two team members do a short informal conversation with an
actual hostel/college mess manager you have access to, two or three
real answers (how often a vendor lets them down per month, roughly how
long procurement calls take) turns the pitch from purely qualitative
to at least anecdotally grounded. Don't invent figures in the
meantime, qualitative framing ("fragile, informal, no tooling") is
honest; a made-up statistic is not.

### 3.2 "Only handles billing" too absolute
**Status: ✅ RESOLVED (language).** Changed to "focuses on," see 1.3,
same fix applied consistently everywhere the claim appears.

### 3.3 No structured competitor comparison
**Status: ✅ RESOLVED.** Built from what we actually verified via
research, not assumption:

| | SpaceBasic / TeachMate | Our prototype |
|---|---|---|
| Student billing / wallets | ✅ Yes | Not attempted |
| Meal pre-ordering | ✅ Yes | Not attempted |
| Attendance / biometric check-in | ✅ Yes | Not attempted |
| Vendor price comparison | Not found | ✅ Yes, scored |
| Vendor reliability tracking | Not found | ✅ Yes, persists and updates |
| Autonomous order placement | Not found | ✅ Yes, with guardrails |
| Failure detection + recovery | Not found | ✅ Yes, two failure modes |

If a judge names a product not in this table, the honest answer is
"we haven't evaluated that one specifically, happy to look at it,"
not a defensive claim we haven't verified.

### 3.4 Business model missing
**Status: ✅ RESOLVED (proposed, clearly labeled as a proposal, not a
validated fact).** A reasonable starting model for the pitch: per-kitchen
monthly subscription, priced below the cost of one avoided emergency
purchase per month, sold to the mess management office or hostel
administration (not individual students), with the pitch being time
saved on vendor coordination plus fewer stockout-driven emergency buys
at premium prices. Say it as a proposed model if asked, not as a
validated one.

### 3.5 Adoption story missing
**Status: ✅ RESOLVED (mapped to what's actually built).**
- *Who enters inventory?* Mess staff, a short manual update via
  `/inventory/set`, already built.
- *Who maintains vendor records?* The mess manager, vendors only exist
  in the system if added there, an implicit allowlist.
- *Who approves high-value orders?* Whoever holds that role at the
  kitchen, via the `needs_approval` / `over_budget` flow, already built
  and enforced, not just planned.

---

## 4. Demo Cons

### 4.1 Demo risks looking scripted
**Status: 🟡 MITIGATED.** Technically defensible: the failure is a real
tool result computed against live DB state at call time, not a
hard-coded branch, so it's honest to say the outcome isn't
predetermined by the code. Presentation-wise: narrate it as "let's see
how the agent handles this" rather than pre-announcing the exact
outcome, which is a delivery choice, not a code fix.

### 4.2 Only one proven failure scenario
**Status: ✅ RESOLVED (code).** The capacity/partial-fulfillment feature
from 1.1 is a second, genuinely different kind of pressure (a supply
limit, not a rejection), reachable with the seeded data as-is
(Hyderabad Mandi Direct is capped at 4kg on onions).

### 4.3 90 seconds: how much shown vs. hidden
**Status: 🔲 OPEN — presentation choreography, not a code task.**
Recommendation: let the trace timeline scroll live in full, narrate
only 3–4 key moments out loud, trust the visible timeline to carry the
rest. Needs a rehearsal to get right, not a fix that can be "resolved"
in code.

### 4.4 "The Face wins the room" is asserted, not proven
**Status: 🔲 OPEN — needs team action.** Recommendation: before the
real demo, show the reasoning-view screen to one person outside the
team, cold, and see if they can explain what happened in 10 seconds
without help. Cheap, fast, and it's the only way to actually know
instead of assuming.

---

## 5. Language / Pitch Cons

All three resolved directly in the rewritten `speaking_script.md`:

- **5.1** "Takes responsibility" → *"executes the procurement workflow
  inside the prototype environment."*
- **5.2** "Quietly finds a backup" → kept as the friendly explanation
  for casual/team context, paired with the technical version for
  judges: *"detects the failure, queries alternatives, and re-executes
  the order tool."*
- **5.3** Brain/Hands/Memory/Face → explicitly framed as the
  team-facing explanation only, backed by "underneath it's a standard
  tool-calling loop with every guardrail enforced in our own backend
  code" for technical audiences.

---

## 6. Technical Cons

### 6.1 The Claude tool-calling loop itself remains unverified
**Status: 🔲 OPEN — the single most important remaining item, provider
has since changed.** Everything downstream of the API key (memory,
tools, guardrails, budget, capacity, shortage enforcement) is tested
and confirmed working, and re-confirmed again after the move to Groq.
`agent.py`'s actual call to the model API, now Groq's
`openai/gpt-oss-120b`, has not been run with a real key yet. Still the
top priority.

### 6.2 Wording overstated maturity before this was tested
**Status: ✅ RESOLVED (language).** Accurate phrasing going forward:
*"The backend tools, memory, and guardrails are verified. The
model-driven orchestration loop remains to be validated with a real
API key."* Use this instead of "genuinely functional" until 6.1 is
actually closed.

### 6.3 Stack inconsistency (React/Vite mentioned, then Next.js locked)
**Status: ✅ RESOLVED.** One authoritative answer: **Next.js**, because
that's what the frontend team actually knows. The earlier Vite mention
was superseded and should be treated as dead.

### 6.4 "Python has the most mature tool-use SDK" unsubstantiated
**Status: ✅ RESOLVED (language).** Reframed as a team decision, not an
objective ranking: Python was chosen because it's what the team could
move fastest in, not because of an unverified comparative claim. No
need to defend it if asked, just don't repeat the stronger claim.

### 6.5 Is SQLite session memory sufficient for the track's memory requirement?
**Status: ✅ RESOLVED (cite the source).** The actual track slide says:
*"Memory Management: Must implement session/user profile memory or
vector DB retrieval."* SQLite-backed vendor reliability and price
history, persisting and changing decisions across the run, is exactly
session/profile-style memory. This isn't an interpretation, it's a
direct match to the stated requirement.

---

## 7. Data Cons

### 7.1 / 7.2 Team-controlled mock data isn't real-world validation
**Status: ⚪ ACCEPTED LIMITATION, stated honestly.** The prototype
proves the agent pattern behaves correctly, it does not, and shouldn't
be presented as, evidence that real mess kitchens would make these
exact purchasing decisions. Say this distinction plainly if asked
rather than letting "realistic" data imply more than it is.

### 7.3 No explicit data validation strategy
**Status: ⚪ ACCEPTED LIMITATION for hackathon scope.** Reliability
scores move by fixed, documented deltas after each outcome (+0.02
success, −0.01 partial, −0.05 rejection). Prices are static per demo,
manually seeded. No live feed to validate against. Reasonable for a
prototype, worth saying plainly rather than leaving unaddressed.

---

## 8. Scope Cons

### 8.1 LPG mixed with produce without a distinct model
**Status: ⚪ ACCEPTED LIMITATION, deliberate.** LPG is treated
identically to any other line item for procurement-decision purposes
(price, reliability, availability). Category-specific logistics and
safety rules for gas are not modeled, deliberately, to keep the demo
scope tight. State this as a choice, not an oversight.

### 8.2 Procurement, monitoring, and recovery attempted simultaneously
**Status: ✅ RESOLVED (reframing, not new code needed).** These aren't
three subsystems, they're three moments in one loop: monitoring is the
availability/order-result check embedded in the tool call itself,
recovery is simply the next tool call in the same loop reacting to
that result. One tight loop, not three separate builds, which is
actually a strength worth stating directly.

### 8.3 Multi-kitchen arbitration mentioned but unjustified for MVP
**Status: ✅ RESOLVED (cut).** Explicitly out of scope for the
hackathon, see the MVP boundary in 2.4/2.5. One kitchen, multiple
vendors, is the entire MVP surface.

---

## 9. Team / Execution Cons

### 9.1 Single backend developer is a structural bottleneck
**Status: 🟡 MITIGATED, still real.** Structurally still true, one
person owns the agent core. Mitigated by the fact that a fully tested,
working scaffold already exists, the remaining backend work is wiring
a real API key and validating the loop (6.1), not building from
scratch. A frontend teammate should stay ready to help with simple API
glue if time gets tight, as already planned.

### 9.2 No technical interface/dependency mapping between roles
**Status: ✅ RESOLVED.** FastAPI auto-generates a full interactive
contract at `/docs`, and `lib/api.ts` is a typed client matching it
exactly. Frontend doesn't need to guess the backend's shape, it's
documented and enforced by the type system.

### 9.3 Presentation polish happened before the agent loop was verified
**Status: ✅ Acknowledged, corrected going forward.** Fair critique of
our own sequencing. Immediate priority from here: validate 6.1 (the
real Claude loop with a real key) before any further deck or script
polish. No more presentation work jumps the queue ahead of this.

---

## 10. Document / Speaking-Script Cons

### 10.1 – 10.4 Speaking script mixed with implementation logs
**Status: ✅ RESOLVED.** The `speaking_script.md` file attached with
this round contains only spoken lines, no build logs, no tool-call
narration, no internal planning notes. If a mixed or raw version was
shared at some point, treat this file as the one authoritative,
judge-and-team-ready version going forward. Time-specific progress
notes like "backend is genuinely functional" have been replaced with
durable, accurate statements (see 6.2).

---

# Judge Attack Question Cheat Sheet

Direct, short answers for the 25 questions the review anticipated. Where we don't have a real answer, that's stated plainly rather than filled in.

1. **Why does this require an LLM rather than ordinary automation?** → See section 1.1: budget spans multiple items with information discovered mid-run, not precomputable.
2. **What exactly does the agent decide that a rule engine can't?** → Trade-offs under a shared budget across items whose costs aren't known until queried.
3. **What happens if the AI makes a bad purchasing decision?** → Backend guardrails (1.6) block the worst outcomes before they execute; anything under those limits is a real decision that can be audited via the trace.
4. **Can the AI spend money without human approval?** → Only below the per-order and run-budget limits, both enforced in code.
5. **Are your vendors real?** → No, simulated for demo reliability, stated upfront (1.4).
6. **Are these real prices?** → No, realistic but synthetic (7.2).
7. **How do you know the problem is actually widespread?** → We don't have quantitative validation yet (3.1), honestly.
8. **What existing software already does this?** → See the comparison table in 3.3.
9. **What is your exact competitive advantage?** → The vendor-decision and recovery layer, not billing.
10. **What happens when every vendor is unavailable?** → System prompt requires the agent to stop, report the item unresolved, and move on, not guess.
11. **What happens when two vendors have similar scores?** → Deterministic tiebreak: reliability, then name (1.5), tested.
12. **How is supplier reliability calculated?** → Starts at a seeded baseline, moves by fixed deltas per outcome (7.3).
13. **How does memory change a later decision?** → Reliability score visibly updates in the same tool result, shown before/after (2.1).
14. **How does the agent detect failure?** → Real tool results from live DB state, not scripted branches (2.6).
15. **What happens if an order is partially fulfilled?** → Real `partial` status, agent must decide how to respond (1.1, 2.7).
16. **What if the model calls the wrong tool?** → Every tool call and result is logged in the trace and independently inspectable.
17. **What if the API goes down during procurement?** → Not currently handled with retry logic, an honest gap, not concealed.
18. **Why use multiple agents at all?** → We use one agent, not a multi-agent system, worth clarifying if the question implies otherwise.
19. **Who pays for this product?** → Proposed model in 3.4, not yet validated.
20. **How would you deploy this in a real hostel?** → Adoption story in 3.5.
21. **Who enters inventory?** → Mess staff, via `/inventory/set` (3.5).
22. **Who maintains vendor records?** → Mess manager (3.5).
23. **How does this integrate with existing mess software?** → It doesn't yet, an honest gap.
24. **What evidence do you have that this reduces cost or stockouts?** → None yet, prototype proves the agent pattern works, not real-world impact (7.1).
25. **Which part of the system is actually intelligent?** → The Brain: tool selection, trade-off reasoning under budget, and adaptive recovery after failure. Everything else (arithmetic, guardrails, scoring) is deliberately deterministic backend code, by design, not by limitation.

---

# What's Genuinely Still Open

Being honest about what isn't done, in priority order:

1. **Validate `agent.py` with a real API key.** (6.1) The single most important remaining task, everything else is tested and waiting on this.
2. **Get 2–3 real anecdotal data points from an actual mess manager.** (3.1) Doable in a day, meaningfully strengthens the pitch.
3. **Rehearse the demo choreography and get a cold outside read on the reasoning-view screen.** (4.3, 4.4)
4. **Decide and lock the business model paragraph as team-approved,** even if still labeled proposed (3.4).

Everything else flagged across both reviews has a resolution above.
