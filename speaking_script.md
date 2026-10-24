# The Speaking Script
### For explaining the game plan to judges or the team out loud

This version has every claim tightened against the foundation review.
Nothing below overstates what the prototype actually does.

---

## 1. Start here: "What are we even solving?"

Say this:

> "Hostel and college mess kitchens buy vegetables, groceries, and gas through phone calls to vendors they know personally. There's no system helping them decide who to order from, and if that vendor can't deliver, the manager has no tool to help them recover, they just scramble."

**If someone asks "isn't this already solved?"** say:

> "The canteen software we looked at, tools like SpaceBasic and TeachMate, focuses on student billing and wallets. We haven't found one that helps with the actual buying decision. That's the specific layer we're building."

Notice what changed: no "nobody," no absolute claim. Say what you found, not what you're certain doesn't exist anywhere.

---

## 2. What are we actually building?

Say this:

> "An agent that looks at tonight's shortage, checks real vendor prices and reliability, and places the order. If a vendor fails, it reacts to that failure as a real event, not a scripted branch, and tries a backup. All of this happens inside a controlled procurement sandbox: the planning, the tool calls, and the order records are real. The vendors and prices are simulated for demo reliability, we're not placing real purchases."

Say the sandbox line every time autonomy or purchasing comes up. It's the difference between "we lied to you" and "here's exactly what's real and what's simulated," and judges will ask.

---

## 3. Why does this need to be an agent, not a rules engine?

This is the question most likely to sink the pitch if you don't have an answer ready. Say this:

> "Prices, vendor capacity, and availability are only known once we actually check them, mid-run. And the whole shortage list shares one budget, so what we spend on the first item changes what's affordable for the third. That's a sequential decision problem where information shows up as you go, not something you can precompute into a fixed table. A rules engine would need a new hand-written branch for every new combination of failure and budget pressure. The agent handles combinations we didn't explicitly code for."

If pushed further:

> "Concretely: our agent can end up buying part of an order from one vendor because they ran out of stock, then has to decide whether to source the rest elsewhere or accept the shortfall, all while tracking a shared budget across other items it hasn't even looked at yet. That decision isn't a sort, it's a live trade-off."

---

## 4. What does the track actually require?

Say this, and if you have it, show the actual hackathon slide:

> "Four things, all required: planning and decomposition, real tool use, memory, and autonomous execution with minimal human input. Stateless single-prompt chatbots are explicitly disqualifying. We're not paraphrasing that, that's a direct quote from the track requirements slide."

---

## 5. How is it actually built?

Say this:

> "Four pieces. The Brain decides what to do next and calls tools to do it. The Hands are real functions: check vendor prices, check availability, check remaining budget, place the order. The Memory is a database that tracks vendor reliability and price history, and it actually changes future decisions, not just stores numbers. The Face is a live dashboard showing what the agent is doing, in plain language, as it happens."

If a technical judge pushes on the metaphor:

> "That's the plain-English version for the team. Underneath it's a standard tool-calling loop against the Groq API, with every guardrail, the budget cap, the approval threshold, the quantity ceiling, enforced in our own backend code, not left to the model to police itself."

---

## 6. What's the moment that wins the demo?

Say this:

> "The agent gets tonight's shortage list and a budget. It checks prices, picks a vendor, places the order. Then, live, we make that vendor's order fail, a real rejection returned by our own tool, not a canned response. The agent reads that result and decides what to do next: try a backup vendor, and it explains why it switched."

If you have time for a second scenario, use it, one failure mode can look rehearsed:

> "We can also show a capacity limit: a vendor can only partially fill an order, and the agent has to decide whether to top up from a second vendor or report the shortfall. Two different kinds of pressure, same agent, no new code path written for either."

---

## 7. What happens if it makes a bad call? What stops it from overspending?

Say this directly, don't wait to be asked:

> "The agent can't self-approve past a set order size, that comes back as needing a human. It can't exceed the total run budget, that's enforced by our backend before the order is placed, not requested politely of the model. And it can't order more of an item than the shortage actually calls for, so it can't duplicate or hallucinate a quantity. All three are backend checks. The model can suggest whatever it wants, the system decides what's actually allowed to happen."

---

## 8. Who's doing what?

Say this:

> "Five of us, five jobs, in the same order the agent itself works in. I own the product, the plan, the pitch, and keeping the team aligned. [Backend person] owns the agent core, the tools, and the guardrails. [Frontend person 1] owns the live screen showing the agent's reasoning. [Frontend person 2] owns the vendor, order, and inventory dashboard. [QA person] owns breaking it before judges do, specifically the failure and capacity scenarios."

---

## 9. What do we need before we can start?

Say this:

> "One real blocker, already cleared: we needed a real API key, and Claude Pro accounts don't give API access, that's the chat app only. We're using Groq, their free tier needs no credit card, so that blocker is gone. Everything downstream of the key, the database, the tools, the guardrails, is already built and tested. Getting a real key in and running one live test is the one piece standing between us and a fully working demo."

---

## Closing line, if you want to end strong

> "We're not building this because the hackathon asked for an agent. We're building it because a mess kitchen manager right now is calling four vendors to find out who has onions today, with no tool helping them decide, and no way to recover automatically when one of them says no."

---

### Quick reference: the whole thing in 30 seconds

> "An agent that manages vegetable and grocery buying for a hostel mess kitchen inside a controlled procurement sandbox. It checks real prices and reliability, places orders under a hard budget and approval limits it can't override, and reacts live when a vendor fails or runs short, switching to a backup and explaining why. The canteen software we've found handles billing, not this decision layer, that's our gap."

---

## If a judge asks something not covered above

Don't improvise a confident-sounding answer to a question you don't have data for. Say what you actually know:

> "That's a fair question we don't have a fully validated answer to yet. Here's what we do know: [state the actual fact you have]. Here's what would need more work to answer properly: [name it honestly]."

This lands better than a guess that falls apart under a follow-up.
