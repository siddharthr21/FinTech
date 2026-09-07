"""
Deterministic Report Generator for the Multi-Agent Fraud Investigation Copilot.
Directly implements 'Action-Level Guardrails' (The Agentic AI Handbook, Ch.9.2).

CRITICAL ARCHITECTURAL GUARANTEE:
This step is pure deterministic code, NOT an LLM call.
No LLM ever writes or modifies the final audit report directly.
This eliminates hallucination risk for compliance and regulatory review.
"""

import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

def validate_agent1_schema(data: Dict[str, Any]) -> bool:
    """Validate Agent 1 schema strictly."""
    if not isinstance(data, dict):
        return False
    if data.get("agent") != "transaction_pattern":
        return False
    if "transaction_id" not in data or "findings" not in data:
        return False
    if not isinstance(data["findings"], list):
        return False
    for item in data["findings"]:
        if not isinstance(item, dict):
            return False
        if item.get("anomaly_type") not in ["velocity", "geography", "amount", "merchant"]:
            return False
        if not isinstance(item.get("severity"), (int, float)):
            return False
        if "evidence" not in item or not isinstance(item["evidence"], dict):
            return False
    return True

def validate_agent2_schema(data: Dict[str, Any]) -> bool:
    """Validate Agent 2 schema strictly."""
    if not isinstance(data, dict):
        return False
    if data.get("agent") != "customer_history":
        return False
    if "customer_id" not in data or "findings" not in data:
        return False
    if not isinstance(data["findings"], list):
        return False
    for item in data["findings"]:
        if not isinstance(item, dict):
            return False
        if item.get("signal_type") not in ["account_maturity", "credential_churn", "prior_flags", "complaint_signal"]:
            return False
        if not isinstance(item.get("severity"), (int, float)):
            return False
        if "evidence" not in item or not isinstance(item["evidence"], dict):
            return False
    return True

def validate_agent3_schema(data: Dict[str, Any]) -> bool:
    """Validate Agent 3 schema strictly."""
    if not isinstance(data, dict):
        return False
    if data.get("agent") != "risk_scoring":
        return False
    if "transaction_id" not in data or "confidence_score" not in data or "verdict" not in data:
        return False
    if data["verdict"] not in ["Likely Fraud", "Needs Review", "Likely Legitimate"]:
        return False
    if not (0 <= data["confidence_score"] <= 100):
        return False
    if not isinstance(data.get("evidence_trail"), list):
        return False
    return True

def build_deterministic_investigation_report(
    transaction_id: str,
    agent1_output: Optional[Dict[str, Any]],
    agent2_output: Optional[Dict[str, Any]],
    agent3_output: Optional[Dict[str, Any]],
    error_message: Optional[str] = None,
    model_provider: Optional[str] = None,
    model_id: Optional[str] = None,
    pipeline_version: Optional[str] = None,
    prompt_version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Assembles the final audit-ready Investigation Report object.

    If any agent failed, crashed, or returned a malformed response,
    this function enforces Chapter 8.1 error classification:
    classify as non-retryable escalate-type failure and set status to
    'Agent Error - Manual Review Required' instead of guessing or retrying.

    model_provider/model_id/pipeline_version/prompt_version are recorded on
    every report (success or error) so a verdict from months ago is
    reproducible: which model produced it, and against which version of the
    prompts and this pipeline. Callers that don't pass them (e.g. direct unit
    tests) get None, which is itself an honest signal - "provenance unknown".
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    report_id = f"REP-{transaction_id}-{int(datetime.now(timezone.utc).timestamp())}"

    # Verify all agent outputs conform to strict schema
    is_agent1_valid = agent1_output and validate_agent1_schema(agent1_output)
    is_agent2_valid = agent2_output and validate_agent2_schema(agent2_output)
    is_agent3_valid = agent3_output and validate_agent3_schema(agent3_output)

    has_error = error_message or not (is_agent1_valid and is_agent2_valid and is_agent3_valid)

    if has_error:
        failure_details = []
        if error_message:
            failure_details.append(f"Pipeline error: {error_message}")
        if not is_agent1_valid:
            failure_details.append("Agent 1 (Transaction-Pattern) malformed or missing output.")
        if not is_agent2_valid:
            failure_details.append("Agent 2 (Customer-History) malformed or missing output.")
        if not is_agent3_valid:
            failure_details.append("Agent 3 (Risk-Scoring Fusion) malformed or missing output.")

        return {
            "report_id": report_id,
            "transaction_id": transaction_id,
            "summary": "SYSTEM ERROR: Investigation pipeline failed schema validation. Escalated to manual review.",
            "confidence_score": 0,
            "verdict": "Needs Review",
            "detected_patterns": agent1_output.get("findings", []) if isinstance(agent1_output, dict) else [],
            "customer_context": agent2_output.get("findings", []) if isinstance(agent2_output, dict) else [],
            "fused_reasoning": f"Audit Pipeline Error: {'; '.join(failure_details)}. Per Handbook Ch.8.1, this non-retryable error requires manual analyst inspection.",
            "evidence_trail": [
                {
                    "claim": "Pipeline execution schema violation detected",
                    "source_agent": "system_guardrail",
                    "source_field": "pipeline_validation",
                    "weight": "high"
                }
            ],
            "recommended_action": "Escalate for Manual Review",
            "pipeline_status": "Agent Error - Manual Review Required",
            "agent1_output_json": json.dumps(agent1_output) if agent1_output else "{}",
            "agent2_output_json": json.dumps(agent2_output) if agent2_output else "{}",
            "agent3_output_json": json.dumps(agent3_output) if agent3_output else "{}",
            "analyst_decision": None,
            "analyst_notes": None,
            "closed_by": None,
            "closed_at": None,
            "model_provider": model_provider,
            "model_id": model_id,
            "pipeline_version": pipeline_version,
            "prompt_version": prompt_version,
            "created_at": now_iso
        }

    # Deterministic assembly of successful report
    confidence = int(agent3_output["confidence_score"])
    verdict = agent3_output["verdict"]
    findings_p = agent1_output.get("findings", [])
    findings_c = agent2_output.get("findings", [])

    summary_text = (
        f"Copilot assessed TX {transaction_id} as '{verdict}' (Confidence: {confidence}%). "
        f"Detected {len(findings_p)} pattern anomal{'ies' if len(findings_p) != 1 else 'y'} "
        f"and {len(findings_c)} contextual history signal{'s' if len(findings_c) != 1 else ''}."
    )

    return {
        "report_id": report_id,
        "transaction_id": transaction_id,
        "summary": summary_text,
        "confidence_score": confidence,
        "verdict": verdict,
        "detected_patterns": findings_p,
        "customer_context": findings_c,
        "fused_reasoning": agent3_output.get("fused_reasoning", ""),
        "evidence_trail": agent3_output.get("evidence_trail", []),
        "recommended_action": agent3_output.get("recommended_analyst_action", "Escalate for Manual Review"),
        "pipeline_status": "Pending Analyst Review",
        "agent1_output_json": json.dumps(agent1_output, indent=2),
        "agent2_output_json": json.dumps(agent2_output, indent=2),
        "agent3_output_json": json.dumps(agent3_output, indent=2),
        "analyst_decision": None,
        "analyst_notes": None,
        "closed_by": None,
        "closed_at": None,
        "model_provider": model_provider,
        "model_id": model_id,
        "pipeline_version": pipeline_version,
        "prompt_version": prompt_version,
        "created_at": now_iso
    }
