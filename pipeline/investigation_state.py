"""
Adaptive Investigation State Machine.
Implements spec §3.3 (Investigation State), §4.3 (Next-Check Selection),
§4.5 (Stopping Conditions), and §13 (Hypothesis-Based Reasoning).

The orchestrator maintains a formal state object that evolves as agents
discover evidence. The next agent is always selected BECAUSE of previous
evidence — the key adaptive behavior the spec demands.

Pure deterministic code. No LLM calls.
"""

from typing import Any, Dict, List, Optional


# Initial hypothesis priors — "innocent until proven guilty"
_DEFAULT_HYPOTHESES = [
    {"name": "legitimate_transaction", "score": 0.50},
    {"name": "account_takeover", "score": 0.20},
    {"name": "coordinated_fraud", "score": 0.15},
    {"name": "false_positive", "score": 0.15},
]

# Investigation catalog — all possible checks
INVESTIGATION_CATALOG = [
    "transaction_history",   # Agent 1: pattern anomalies
    "account_identity",      # Agent 2: credential / identity signals
    "risk_fusion",           # Agent 3: cross-agent corroboration
    "network_analysis",      # Ring Detector: fraud ring graph
]

MAX_CHECKS = 5  # Budget cap (spec §4.5)


def _normalize_hypotheses(hypotheses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Normalize hypothesis scores to sum to 1.0, clamping negatives to 0."""
    for h in hypotheses:
        h["score"] = max(0.0, h["score"])
    total = sum(h["score"] for h in hypotheses)
    if total > 0:
        for h in hypotheses:
            h["score"] = round(h["score"] / total, 4)
    return hypotheses


def _has_anomaly(agent_output: Optional[Dict], anomaly_type: str) -> bool:
    """Check if an agent output contains a finding of the given anomaly type."""
    if not agent_output:
        return False
    for f in agent_output.get("findings", []):
        if f.get("anomaly_type") == anomaly_type:
            return True
    return False


def _has_signal(agent_output: Optional[Dict], signal_type: str) -> bool:
    """Check if Agent 2 output contains a finding of the given signal type."""
    if not agent_output:
        return False
    for f in agent_output.get("findings", []):
        if f.get("signal_type") == signal_type:
            return True
    return False


def _max_severity(agent_output: Optional[Dict]) -> int:
    """Return the maximum severity from an agent's findings, or 0."""
    if not agent_output:
        return 0
    sevs = [f.get("severity", 0) for f in agent_output.get("findings", [])]
    return max(sevs) if sevs else 0


class InvestigationState:
    """
    Formal investigation state object (spec §3.3).

    Tracks completed/pending checks, the ordered investigation path with
    trigger reasons, competing hypotheses, accumulated evidence, and the
    overall risk score.
    """

    def __init__(self, transaction: Dict[str, Any]):
        self.transaction_id = transaction.get("transaction_id", "TX-UNKNOWN")
        self.customer_id = transaction.get("customer_id", "CUST-UNKNOWN")
        self.completed_checks: List[str] = []
        self.pending_checks: List[str] = list(INVESTIGATION_CATALOG)
        self.investigation_path: List[Dict[str, Any]] = []
        self.hypotheses: List[Dict[str, Any]] = [
            dict(h) for h in _DEFAULT_HYPOTHESES
        ]
        self.risk_score: float = 0.0
        self.status: str = "investigating"

        # Stored agent outputs for cross-referencing during selection
        self._agent_outputs: Dict[str, Dict[str, Any]] = {}

    def get_agent_output(self, check_name: str) -> Optional[Dict[str, Any]]:
        return self._agent_outputs.get(check_name)

    def record_step(
        self,
        check_name: str,
        agent_name: str,
        output: Dict[str, Any],
        trigger: str = "initial",
    ):
        """Record that a check was executed, its trigger reason, and findings summary."""
        self.completed_checks.append(check_name)
        if check_name in self.pending_checks:
            self.pending_checks.remove(check_name)
        self._agent_outputs[check_name] = output

        # Build human-readable evidence summary from findings
        evidence_found = []
        for f in output.get("findings", []):
            atype = f.get("anomaly_type") or f.get("signal_type") or "signal"
            sev = f.get("severity", 0)
            evidence_found.append(f"{atype} (severity {sev})")

        # For ring detector, summarize differently
        if check_name == "network_analysis":
            ring_score = output.get("ring_score", 0)
            signals = output.get("signals_triggered", [])
            evidence_found = [f"ring_score={ring_score}%"]
            if signals:
                evidence_found.append(f"signals: {', '.join(signals)}")

        step = {
            "step": len(self.investigation_path) + 1,
            "agent": agent_name,
            "check": check_name,
            "trigger": trigger,
            "evidence_found": evidence_found,
        }
        self.investigation_path.append(step)

    def choose_next_check(self) -> Optional[str]:
        """
        Evidence-driven next-agent selection (spec §4.3).

        The key requirement: the next agent is selected BECAUSE of previous
        evidence, not by default.
        """
        # Step 1: Transaction history analysis is always first
        if "transaction_history" not in self.completed_checks:
            return "transaction_history"

        a1 = self.get_agent_output("transaction_history")

        # Step 2: Account/Identity check — triggered by evidence from Step 1
        if "account_identity" not in self.completed_checks:
            # Evidence-driven triggers
            if _has_anomaly(a1, "geography"):
                return "account_identity"  # trigger: geo anomaly warrants device/credential check
            if _has_anomaly(a1, "velocity"):
                return "account_identity"  # trigger: velocity warrants identity verification
            if _has_anomaly(a1, "amount"):
                return "account_identity"  # trigger: amount deviation warrants account maturity check
            # If Agent 1 found nothing, still run Agent 2 (baseline check)
            # but with a different trigger reason
            return "account_identity"

        # Step 3: Risk fusion — runs after both specialists complete
        if "risk_fusion" not in self.completed_checks:
            return "risk_fusion"

        # Step 4: Network analysis — ONLY if prior evidence warrants it
        if "network_analysis" not in self.completed_checks:
            a2 = self.get_agent_output("account_identity")
            a3 = self.get_agent_output("risk_fusion")
            confidence = (a3 or {}).get("confidence_score", 0)

            # Evidence-driven triggers for network investigation
            if _has_signal(a2, "credential_churn"):
                return "network_analysis"
            if _has_signal(a2, "complaint_signal"):
                return "network_analysis"
            if _has_anomaly(a1, "geography") and _max_severity(a1) >= 80:
                return "network_analysis"
            if confidence >= 60:
                return "network_analysis"
            # If risk is low, skip network analysis entirely
            # This is the adaptive behavior: NOT running a check because
            # prior evidence doesn't warrant it

        return None  # Investigation complete

    def get_trigger_reason(self) -> str:
        """Generate a human-readable trigger reason for the current next check."""
        next_check = self.choose_next_check()
        if next_check is None:
            return "investigation_complete"

        if next_check == "transaction_history":
            return "initial: always analyze transaction patterns first"

        a1 = self.get_agent_output("transaction_history")

        if next_check == "account_identity":
            triggers = []
            if _has_anomaly(a1, "geography"):
                triggers.append("geography anomaly")
            if _has_anomaly(a1, "velocity"):
                triggers.append("velocity anomaly")
            if _has_anomaly(a1, "amount"):
                triggers.append("amount deviation")
            if _has_anomaly(a1, "merchant"):
                triggers.append("merchant anomaly")
            if triggers:
                return f"evidence: {', '.join(triggers)} detected in Step 1"
            return "baseline: routine identity verification"

        if next_check == "risk_fusion":
            return "both specialists complete: cross-referencing findings"

        if next_check == "network_analysis":
            a2 = self.get_agent_output("account_identity")
            a3 = self.get_agent_output("risk_fusion")
            triggers = []
            if _has_signal(a2, "credential_churn"):
                triggers.append("credential churn")
            if _has_signal(a2, "complaint_signal"):
                triggers.append("customer complaint")
            if _has_anomaly(a1, "geography") and _max_severity(a1) >= 80:
                triggers.append("high-severity geography anomaly")
            confidence = (a3 or {}).get("confidence_score", 0)
            if confidence >= 60:
                triggers.append(f"elevated fusion risk ({confidence}%)")
            return f"evidence: {', '.join(triggers)}" if triggers else "evidence: elevated risk indicators"

        return "unknown"

    def update_hypotheses_from_agent1(self, output: Dict[str, Any]):
        """Shift hypothesis scores based on Agent 1 (Transaction-Pattern) findings."""
        h = {x["name"]: x for x in self.hypotheses}

        if _has_anomaly(output, "geography"):
            h["account_takeover"]["score"] += 0.15
            h["coordinated_fraud"]["score"] += 0.08
            h["legitimate_transaction"]["score"] -= 0.15

        if _has_anomaly(output, "velocity"):
            h["coordinated_fraud"]["score"] += 0.10
            h["legitimate_transaction"]["score"] -= 0.10

        if _has_anomaly(output, "amount"):
            h["account_takeover"]["score"] += 0.05
            h["coordinated_fraud"]["score"] += 0.05
            h["legitimate_transaction"]["score"] -= 0.08

        if _has_anomaly(output, "merchant"):
            h["account_takeover"]["score"] += 0.05
            h["legitimate_transaction"]["score"] -= 0.05

        # If no anomalies found at all, strengthen legitimacy
        if not output.get("findings"):
            h["legitimate_transaction"]["score"] += 0.15
            h["false_positive"]["score"] += 0.10

        self.hypotheses = _normalize_hypotheses(list(h.values()))

    def update_hypotheses_from_agent2(self, output: Dict[str, Any]):
        """Shift hypothesis scores based on Agent 2 (Customer-History) findings."""
        h = {x["name"]: x for x in self.hypotheses}

        if _has_signal(output, "credential_churn"):
            h["account_takeover"]["score"] += 0.25
            h["legitimate_transaction"]["score"] -= 0.20

        if _has_signal(output, "complaint_signal"):
            h["account_takeover"]["score"] += 0.15
            h["legitimate_transaction"]["score"] -= 0.10

        if _has_signal(output, "account_maturity"):
            h["coordinated_fraud"]["score"] += 0.08
            h["legitimate_transaction"]["score"] -= 0.05

        # If zero findings, strengthen legitimacy
        if not output.get("findings"):
            h["legitimate_transaction"]["score"] += 0.15
            h["false_positive"]["score"] += 0.10

        self.hypotheses = _normalize_hypotheses(list(h.values()))

    def update_hypotheses_from_ring(self, ring_output: Dict[str, Any]):
        """Shift hypothesis scores based on Ring Detector findings."""
        h = {x["name"]: x for x in self.hypotheses}

        if ring_output.get("is_suspicious_ring"):
            h["coordinated_fraud"]["score"] += 0.28
            h["legitimate_transaction"]["score"] -= 0.20
            h["false_positive"]["score"] -= 0.10
        else:
            h["legitimate_transaction"]["score"] += 0.10
            h["false_positive"]["score"] += 0.10

        self.hypotheses = _normalize_hypotheses(list(h.values()))
        self.risk_score = max(
            self.risk_score,
            ring_output.get("ring_score", 0) / 100.0,
        )

    def update_risk_from_agent3(self, output: Dict[str, Any]):
        """Update the overall risk score from Agent 3's confidence."""
        confidence = output.get("confidence_score", 0)
        self.risk_score = max(self.risk_score, confidence / 100.0)

    def should_stop(self) -> bool:
        """Stopping conditions (spec §4.5)."""
        if self.risk_score >= 0.95:
            return True
        if len(self.pending_checks) == 0:
            return True
        if len(self.completed_checks) >= MAX_CHECKS:
            return True
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Serialize for inclusion in the investigation report."""
        # Sort hypotheses by score descending for display
        sorted_hyp = sorted(self.hypotheses, key=lambda h: h["score"], reverse=True)
        return {
            "transaction_id": self.transaction_id,
            "customer_id": self.customer_id,
            "completed_checks": self.completed_checks,
            "pending_checks": self.pending_checks,
            "investigation_path": self.investigation_path,
            "hypotheses": sorted_hyp,
            "risk_score": round(self.risk_score, 4),
            "status": "complete" if self.should_stop() or self.choose_next_check() is None else "investigating",
        }
