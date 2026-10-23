"""
The agent loop, on Groq's OpenAI-style Chat Completions API.

Wire-format notes:
  - Tools are wrapped as {"type": "function", "function": {...}} (see
    tools.TOOL_DEFINITIONS).
  - One response has one assistant message (response.choices[0].message)
    with optional .content and optional .tool_calls.
  - Each tool_call's arguments arrive as a JSON string and must be
    json.loads()'d before use.
  - The loop continues while finish_reason == "tool_calls".
  - Tool results go back as {"role": "tool", "tool_call_id": ..., "content": ...}.

Why an agent and not a rules engine: prices, availability and vendor
capacity are only known once queried mid-run, and one budget spans every
item in the shortage list, so an early item's outcome changes what is
affordable for a later one. A rules engine would need a hand-written
branch for every mix of failure, capacity and budget.

The agent never does quantity arithmetic; its objective is the shortage
list from planning.py. Vendor reliability and price history (memory.py)
change future decisions; agent_trace is only an execution log. Every
limit (single-order cap, run budget, shortage ceiling) is enforced in
tools.py, not asked of the model.
"""

import os
import json
from groq import Groq

import memory
import tools
import planning

# openai/gpt-oss-20b is faster and cheaper for repeated demo runs, same
# tool-calling behaviour.
# llama-3.3-70b-versatile and llama-3.1-8b-instant were deprecated by Groq
# on 2026-08-16, don't use them.
MODEL = "openai/gpt-oss-120b"

SYSTEM_PROMPT = f"""You are the procurement agent for a hostel mess kitchen in Hyderabad.

You will be given a shortage list: ingredients already calculated to be
short of what's needed, with quantities already computed by the backend.
Do not recalculate or second-guess these quantities, treat them as fact.

You are also given a total run budget. This budget covers the ENTIRE
shortage list, not one item. You do not know vendor prices until you
check them, so you cannot plan your full spend in advance, you have to
discover it as you go and adapt.

Your job for each item in the shortage list:
1. Call check_vendor_prices to see known vendors, price, capacity, and
   computed score (reliability and price already weighted for you, do
   not invent your own weighting).
2. Call check_vendor_availability on your top candidate before ordering.
3. If you're unsure how much budget is left, call check_budget_status.
   Do not try to track the running total yourself from memory of past
   tool results, always check.
4. Call place_order. Several outcomes are possible, all real, react to
   whichever one you get:
   - "placed": succeeded in full.
   - "partial": the vendor could only fulfill part of the quantity.
     Decide whether to source the rest from another vendor, or accept
     the shortfall and report it, don't just ignore the gap.
   - "needs_approval": total is at/above the auto-approve limit. You
     cannot override this. Report it and move on to the next item.
   - "over_budget": this order would break the run budget. Try a
     cheaper vendor or a smaller quantity if that still meaningfully
     helps, otherwise report the item as unaffordable within budget
     and move on. Do not keep retrying the same order hoping the
     budget changes, it won't.
   - "rejected" or "failed": check the next-best vendor for the same
     item and try again. Briefly note why you switched.
   - "exceeds_shortage": you've already covered this item, don't order
     more of it in this run.
5. If every known vendor for an item is unavailable, rejects the order,
   or is unaffordable, stop trying for that item. Report it clearly as
   unresolved and move to the next item. Do not guess or fabricate a
   vendor.

When you are completely done with the shortage list, give a short
plain-language summary: what you bought, from whom, any vendor
switches, any partial fulfillments, anything needing human approval,
anything left unresolved, and how much of the budget you used."""


def _message_to_trace_steps(message):
    """
    Turn one Groq assistant message into loggable trace steps. The message
    can carry both .content and .tool_calls at once (a reasoning model may
    narrate briefly and call a tool in the same turn).
    """
    steps = []
    if message.content:
        steps.append(("plan", {"text": message.content}, message.content))
    if message.tool_calls:
        for tc in message.tool_calls:
            args = json.loads(tc.function.arguments)
            event = tools.describe_event(tc.function.name, "call", args)
            steps.append(("tool_call", {"tool": tc.function.name, "input": args, "id": tc.id}, event))
    return steps


def run_procurement_cycle(objective: str, budget: float = None, shortage: dict = None,
                           max_turns: int = 24) -> dict:
    """
    The agent loop. `objective` should be the formatted shortage list from
    planning.py, not raw menu text. `shortage`, if given, is saved so
    place_order can block duplicate or over-quantity orders. `budget`, if
    given, is enforced by place_order.
    """
    api_key = os.environ.get("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GROQ_API_KEY is not set. Copy .env.example to .env and add a real key "
            "from console.groq.com/keys before running the agent."
        )
    client = Groq(api_key=api_key)

    run_id = memory.start_run(objective, budget=budget)
    if shortage:
        memory.save_run_shortage(run_id, shortage)

    step_number = 0
    full_objective = objective
    if budget is not None:
        full_objective += f"\n\nTotal run budget: \u20b9{budget}. Your run_id is {run_id}, use it for check_budget_status."

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": full_objective},
    ]

    final_summary = None

    for turn in range(max_turns):
        response = client.chat.completions.create(
            model=MODEL,
            max_completion_tokens=1024,
            reasoning_effort="medium",
            reasoning_format="hidden",  # keep internal reasoning out of visible content/trace
            tools=tools.TOOL_DEFINITIONS,
            messages=messages,
        )

        message = response.choices[0].message
        finish_reason = response.choices[0].finish_reason

        for step_type, payload, event in _message_to_trace_steps(message):
            step_number += 1
            memory.log_trace_step(run_id, step_number, step_type, {**payload, "event": event})

        assistant_message = {"role": "assistant", "content": message.content}
        if message.tool_calls:
            assistant_message["tool_calls"] = [
                {"id": tc.id, "type": "function",
                 "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                for tc in message.tool_calls
            ]
        messages.append(assistant_message)

        if finish_reason != "tool_calls" or not message.tool_calls:
            final_summary = (message.content or "").strip()
            step_number += 1
            memory.log_trace_step(run_id, step_number, "decision", {
                "summary": final_summary, "event": "Agent finished: final summary below",
            })
            break

        for tc in message.tool_calls:
            args = json.loads(tc.function.arguments)
            result = tools.execute_tool(tc.function.name, args, run_id)
            event = tools.describe_event(tc.function.name, "result", result)
            step_number += 1
            memory.log_trace_step(run_id, step_number, "tool_result", {
                "tool": tc.function.name, "result": result, "tool_use_id": tc.id, "event": event,
            })
            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": json.dumps(result),
            })

    memory.finish_run(run_id, "complete" if final_summary else "incomplete")

    return {
        "run_id": run_id,
        "objective": objective,
        "budget": budget,
        "spent": round(memory.get_spent_so_far(run_id), 2) if budget is not None else None,
        "summary": final_summary or "Agent hit max_turns without a final decision. Check the trace.",
        "trace": memory.get_trace(run_id),
    }