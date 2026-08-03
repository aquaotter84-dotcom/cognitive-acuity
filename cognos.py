#!/usr/bin/env python3
"""
Cognos - Layered cognitive architecture using a single Multimodel backend.

Usage:
  - Set environment variables:
      MULTIMODEL_API_KEY (required)
      MULTIMODEL_API_URL (optional, default is placeholder)
  - Call cognos.run(input_payload) which returns the final, integrity-checked output.

Design highlights:
  - Foundational layer: low-latency model for perception -> structured observations
  - Architectural layer: high-cap model for planning -> candidate reasoning paths
  - Meta layer: critique model for self-review -> refinements
  - Sovereign layer: enforces integrity and can reject -> forces loop rerun
  - Shared Context object passed through each layer
"""

import os
import asyncio
import json
import logging
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
import httpx

# --- Configuration ---
MULTIMODEL_API_KEY = os.getenv("MULTIMODEL_API_KEY")
MULTIMODEL_API_URL = os.getenv("MULTIMODEL_API_URL", "https://api.multimodel.example/v1/infer")
# Example model identifiers; replace with your actual multimodel model ids
MODEL_PROFILES = {
    "foundational": {"model": "mm-low-latency", "temperature": 0.0, "max_tokens": 512},
    "architectural": {"model": "mm-high-cap", "temperature": 0.3, "max_tokens": 1024},
    "meta": {"model": "mm-critic", "temperature": 0.0, "max_tokens": 512},
    "sovereign": {"model": "mm-sovereign", "temperature": 0.0, "max_tokens": 512},
}

# Loop control
MAX_DELIBERATION_LOOPS = 3

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("cognos")


# --- Context ---
@dataclass
class CognosContext:
    input_payload: Any
    observations: Optional[Dict[str, Any]] = None
    candidate_plans: Optional[List[Dict[str, Any]]] = None
    critiques: Optional[List[Dict[str, Any]]] = None
    refined_plan: Optional[Dict[str, Any]] = None
    final_output: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    loop_history: List[Dict[str, Any]] = field(default_factory=list)


# --- Low-level model call ---
async def call_multimodel_api(
    model: str,
    prompt: str,
    temperature: float = 0.0,
    max_tokens: int = 512,
    response_format: str = "json",
    multimodal_inputs: Optional[Dict[str, Any]] = None,
    timeout: int = 30,
) -> Dict[str, Any]:
    """
    Call the Multimodel inference endpoint. This implementation expects the endpoint to accept
    JSON with keys: model, prompt, temperature, max_tokens, response_format, multimodal_inputs.
    Adjust to match the real Multimodel API spec in your deployment.
    """
    if not MULTIMODEL_API_KEY:
        raise RuntimeError("MULTIMODEL_API_KEY environment variable is not set")

    payload = {
        "model": model,
        "prompt": prompt,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": response_format,
    }
    if multimodal_inputs:
        payload["multimodal_inputs"] = multimodal_inputs

    headers = {
        "Authorization": f"Bearer {MULTIMODEL_API_KEY}",
        "Content-Type": "application/json",
        "User-Agent": "cognos/1.0",
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.post(MULTIMODEL_API_URL, headers=headers, json=payload)
        r.raise_for_status()
        return r.json()


# --- Prompt templates (simple, explicit JSON-output requests) ---
PROMPTS = {
    "foundational": """You are the Foundational Layer: fast, low-latency perception and multimodal grounding.
Input: {input_payload}
Task: Produce structured observations extracted from the input. Output MUST be valid JSON with keys:
  - observations: a dict where keys are observation categories and values are details
  - uncertainty_scores: a dict mapping categories->0.0-1.0
Keep responses concise and structured.""",

    "architectural": """You are the Architectural Layer: planning & structuring.
Input observations (JSON): {observations}
Task: Produce a list of candidate reasoning paths / plans. Output MUST be JSON:
  - candidate_plans: list of plans; each plan is {{id, summary, steps: [ ... ], expected_outcome, confidence}}
Prioritize diversity of hypotheses, clearly state assumptions for each plan.""",

    "meta": """You are the Meta Layer: critique, error detection, and iterative improvement.
Input candidate_plans (JSON): {candidate_plans}
Task: For each candidate plan, produce a critique entry and one suggested refinement.
Output MUST be JSON:
  - critiques: list of {{plan_id, issues: [...], severity_scores: [...], suggested_changes: {...}}}
Also produce a recommended refined_plan chosen from candidate_plans with applied suggested_changes.""",

    "sovereign": """You are the Sovereign Layer: integrity, direction, and values enforcer.
Input: refined_plan (JSON) and full context (JSON): {refined_plan} | {full_context}
Task: Evaluate the refined_plan for alignment with integrity constraints (consistency, safety, long-term direction).
Output MUST be JSON:
  - accept: true/false
  - reasons: list of strings
  - adjustments: a dict describing required adjustments to the plan or arguments to re-run the loop (optional)
  - final_output: the integrity-constrained output (if accept is true), otherwise may be null
If you set accept=false, provide explicit adjustments and a short rationale so the pipeline can re-run with modifications.
""",
}


# --- Layer implementations ---
async def foundational_layer(context: CognosContext) -> CognosContext:
    profile = MODEL_PROFILES["foundational"]
    prompt = PROMPTS["foundational"].format(input_payload=json.dumps(context.input_payload))
    logger.debug("Foundational prompt: %s", prompt)
    resp = await call_multimodel_api(
        model=profile["model"], prompt=prompt, temperature=profile["temperature"], max_tokens=profile["max_tokens"]
    )
    # Expect JSON in resp["output"] or similar; robust parsing:
    raw_output = resp.get("output") or resp
    if isinstance(raw_output, str):
        try:
            parsed = json.loads(raw_output)
        except Exception:
            parsed = {"observations": {"raw_text": raw_output}, "uncertainty_scores": {}}
    else:
        parsed = raw_output

    context.observations = parsed.get("observations", parsed)
    context.metadata.setdefault("foundational_raw", parsed)
    context.loop_history.append({"layer": "foundational", "result": parsed})
    return context


async def architectural_layer(context: CognosContext) -> CognosContext:
    profile = MODEL_PROFILES["architectural"]
    prompt = PROMPTS["architectural"].format(observations=json.dumps(context.observations))
    logger.debug("Architectural prompt: %s", prompt)
    resp = await call_multimodel_api(
        model=profile["model"], prompt=prompt, temperature=profile["temperature"], max_tokens=profile["max_tokens"]
    )
    raw_output = resp.get("output") or resp
    if isinstance(raw_output, str):
        try:
            parsed = json.loads(raw_output)
        except Exception:
            parsed = {"candidate_plans": [{"id": "p1", "summary": raw_output, "steps": [], "expected_outcome": None, "confidence": 0.5}]}
    else:
        parsed = raw_output

    context.candidate_plans = parsed.get("candidate_plans", parsed.get("plans", []))
    context.metadata.setdefault("architectural_raw", parsed)
    context.loop_history.append({"layer": "architectural", "result": parsed})
    return context


async def meta_layer(context: CognosContext) -> CognosContext:
    profile = MODEL_PROFILES["meta"]
    prompt = PROMPTS["meta"].format(candidate_plans=json.dumps(context.candidate_plans))
    logger.debug("Meta prompt: %s", prompt)
    resp = await call_multimodel_api(
        model=profile["model"], prompt=prompt, temperature=profile["temperature"], max_tokens=profile["max_tokens"]
    )
    raw_output = resp.get("output") or resp
    if isinstance(raw_output, str):
        try:
            parsed = json.loads(raw_output)
        except Exception:
            parsed = {"critiques": [], "refined_plan": context.candidate_plans[0] if context.candidate_plans else {}}
    else:
        parsed = raw_output

    context.critiques = parsed.get("critiques", [])
    context.refined_plan = parsed.get("refined_plan", parsed.get("refinement") or (context.candidate_plans[0] if context.candidate_plans else {}))
    context.metadata.setdefault("meta_raw", parsed)
    context.loop_history.append({"layer": "meta", "result": parsed})
    return context


async def sovereign_layer(context: CognosContext) -> CognosContext:
    profile = MODEL_PROFILES["sovereign"]
    prompt = PROMPTS["sovereign"].format(refined_plan=json.dumps(context.refined_plan), full_context=json.dumps(asdict(context)))
    logger.debug("Sovereign prompt: %s", prompt)
    resp = await call_multimodel_api(
        model=profile["model"], prompt=prompt, temperature=profile["temperature"], max_tokens=profile["max_tokens"]
    )
    raw_output = resp.get("output") or resp
    if isinstance(raw_output, str):
        try:
            parsed = json.loads(raw_output)
        except Exception:
            # Conservative default: reject if parsing fails
            parsed = {"accept": False, "reasons": ["sovereign parsing failure"], "adjustments": {"note": "sovereign could not parse model output"}}
    else:
        parsed = raw_output

    # Enforce structure
    accept = parsed.get("accept", False)
    reasons = parsed.get("reasons", [])
    adjustments = parsed.get("adjustments", {})
    final_output = parsed.get("final_output") if accept else None

    context.metadata.setdefault("sovereign_raw", parsed)
    context.loop_history.append({"layer": "sovereign", "result": parsed})

    if accept:
        context.final_output = final_output or {"refined_plan": context.refined_plan, "notes": reasons}
        context.metadata["sovereign_accepted"] = True
    else:
        context.metadata["sovereign_accepted"] = False
        context.metadata["sovereign_reasons"] = reasons
        context.metadata["sovereign_adjustments"] = adjustments

    return context


# --- Pipeline runner ---
async def run_once(context: CognosContext) -> CognosContext:
    """
    Runs one pass: Foundational -> Architectural -> Meta -> Sovereign.
    """
    context = await foundational_layer(context)
    context = await architectural_layer(context)
    context = await meta_layer(context)
    context = await sovereign_layer(context)
    return context


async def run(input_payload: Any, max_loops: int = MAX_DELIBERATION_LOOPS, debug: bool = False) -> CognosContext:
    """
    Top-level API. Runs the deliberation loop until Sovereign accepts or until max_loops reached.
    Returns the final CognosContext.
    """
    ctx = CognosContext(input_payload=input_payload)
    attempts = 0
    while attempts < max_loops:
        attempts += 1
        if debug:
            logger.info("Cognos loop iteration %d", attempts)
        ctx = await run_once(ctx)
        accepted = ctx.metadata.get("sovereign_accepted", False)
        if accepted:
            if debug:
                logger.info("Sovereign accepted output on iteration %d", attempts)
            ctx.metadata["deliberation_iterations"] = attempts
            return ctx
        # Sovereign rejected - apply adjustments if present and re-run
        adjustments = ctx.metadata.get("sovereign_adjustments") or {}
        if debug:
            logger.info("Sovereign rejected output on iteration %d: %s", attempts, ctx.metadata.get("sovereign_reasons"))
            logger.info("Applying adjustments: %s", adjustments)
        # Simple adjustment handlers - can be expanded by user
        # Example adjustments might include: "focus_on": "safety", "prefer_plan_id": "p2", "decrease_temperature": 0.0
        # We merge adjustments into metadata so next run can pick them up via prompts or internal logic.
        ctx.metadata.setdefault("adjustment_history", []).append({"iteration": attempts, "adjustments": adjustments})
        # For demonstration: if adjustments request a specific candidate plan, set refined_plan accordingly
        prefer_plan = adjustments.get("prefer_plan_id")
        if prefer_plan and ctx.candidate_plans:
            chosen = next((p for p in ctx.candidate_plans if p.get("id") == prefer_plan), None)
            if chosen:
                ctx.refined_plan = chosen
        # Apply any directive to mark certain observations as "must not change" or similar
        # Clear previous critiques/final_output for clean re-run
        ctx.critiques = None
        ctx.final_output = None
        # Continue loop
    # Max iterations reached - return last context with a flag
    ctx.metadata["deliberation_iterations"] = attempts
    ctx.metadata["deliberation_status"] = "max_iterations_reached"
    logger.warning("Maximum deliberation loops reached (%d). Returning last context.", max_loops)
    return ctx


# --- Sync wrapper for convenience ---
def run_sync(input_payload: Any, max_loops: int = MAX_DELIBERATION_LOOPS, debug: bool = False) -> CognosContext:
    return asyncio.run(run(input_payload=input_payload, max_loops=max_loops, debug=debug))


# --- Example CLI-run / test usage ---
if __name__ == "__main__":
    # Minimal demo. Replace input_payload with your multimodal content or structured prompt.
    sample_input = {
        "task": "Propose three novel research directions at the intersection of reinforcement learning and symbolic reasoning.",
        "context": {"recent_papers": ["paperA", "paperB"], "constraints": ["safety", "feasibility"]},
    }
    try:
        result = run_sync(sample_input, debug=True)
        print("=== Final Cognos Context ===")
        print(json.dumps(asdict(result), indent=2, ensure_ascii=False))
    except Exception as e:
        logger.exception("Cognos run failed: %s", e)
