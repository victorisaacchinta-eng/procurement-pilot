"""
The Face's backend: FastAPI endpoints the Next.js frontend calls.

Run with: uvicorn main:app --reload --port 8000
Then visit http://localhost:8000/docs for the auto-generated API contract
your frontend teammates can build against immediately.
"""
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

import memory
import agent
import planning

app = FastAPI(title="Mess Kitchen Procurement Agent")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
    "http://localhost:3000",
    "https://procurement-pilot-frontend.onrender.com",
],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup():
    memory.init_db()


class RunRequest(BaseModel):
    objective: str


@app.post("/agent/run")
def run_agent(req: RunRequest):
    """Manual entrypoint: pass a raw objective string directly. Useful
    for testing the agent loop in isolation. The real demo path is
    /kitchen/run-procurement below, which computes the objective
    deterministically instead of trusting free text."""
    try:
        return agent.run_procurement_cycle(req.objective)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


class KitchenRunRequest(BaseModel):
    menu: List[str]
    student_count: int
    budget: float | None = None


@app.post("/kitchen/run-procurement")
def run_kitchen_procurement(req: KitchenRunRequest):
    """
    The real demo entrypoint. Menu and student count go in, deterministic
    backend logic computes ingredient requirements and shortage against
    current inventory, and ONLY the resulting shortage list is handed to
    the agent. If there's no shortage, the agent never runs at all.

    If `budget` isn't provided, we compute a reasonable default: the
    cost of buying everything from the cheapest known vendor per item,
    with a 15% buffer. This means a naive greedy plan usually fits, but
    a plan that leans on the most reliable (not cheapest) vendor for
    everything usually won't, forcing genuine trade-off decisions.
    """
    requirements = planning.calculate_requirements(req.menu, req.student_count)
    inventory = planning.get_inventory()
    shortage = planning.calculate_shortage(requirements, inventory)

    if not shortage:
        return {
            "status": "no_action_needed",
            "requirements": requirements,
            "inventory": inventory,
            "message": "Current stock covers tonight's menu, no procurement needed.",
        }

    budget = req.budget
    if budget is None:
        budget = planning.estimate_default_budget(shortage)

    objective_lines = ["Procure the following shortage items:"]
    for item, info in shortage.items():
        objective_lines.append(f"- {item}: {info['quantity']} {info['unit']}")
    objective = "\n".join(objective_lines)

    try:
        result = agent.run_procurement_cycle(objective, budget=budget, shortage=shortage)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    result["shortage"] = shortage
    result["requirements"] = requirements
    return result


@app.get("/agent/trace/{run_id}")
def get_trace(run_id: int):
    run = memory.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return {"run": run, "trace": memory.get_trace(run_id)}


@app.get("/vendors")
def get_vendors():
    return memory.list_vendors()


@app.get("/orders")
def get_orders():
    return memory.list_orders()


@app.get("/inventory")
def get_inventory():
    return planning.get_inventory()


class SetInventoryRequest(BaseModel):
    item: str
    quantity: float
    unit: str


@app.post("/inventory/set")
def set_inventory(req: SetInventoryRequest):
    """Manual/simulated inventory update. Digital inventory is the
    system's source of truth for this demo."""
    planning.set_inventory(req.item, req.quantity, req.unit)
    return {"item": req.item, "quantity": req.quantity, "unit": req.unit}


class DemoFailRequest(BaseModel):
    vendor_name: str
    available: bool = False


@app.post("/demo/set-vendor-availability")
def demo_fail_vendor(req: DemoFailRequest):
    """
    Demo control, not an agent tool. Flip a vendor to unavailable BEFORE
    the agent even checks, so it skips straight to the next candidate.
    """
    vendor = memory.get_vendor_by_name(req.vendor_name)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    memory.set_vendor_availability(req.vendor_name, req.available)
    return {"vendor": req.vendor_name, "available": req.available}


class DemoFailNextOrderRequest(BaseModel):
    vendor_name: str
    should_fail: bool = True


@app.post("/demo/fail-next-order")
def demo_fail_next_order(req: DemoFailNextOrderRequest):
    """
    Second demo failure mode: the vendor still passes the availability
    check, but the NEXT order placed with them gets rejected. This is
    the more dramatic version, the agent commits, then gets bounced.
    Fires once, then clears itself automatically.
    """
    vendor = memory.get_vendor_by_name(req.vendor_name)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    memory.set_vendor_fail_next_order(req.vendor_name, req.should_fail)
    return {"vendor": req.vendor_name, "will_fail_next_order": req.should_fail}
