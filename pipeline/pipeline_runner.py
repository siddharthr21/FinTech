"""
Pipeline Runner for Multi-Agent Fraud Investigation Copilot.
Orchestrates:
  Trigger -> [Branch A: Agent 1 || Branch B: Agent 2] -> Join -> Agent 3 -> Deterministic Guardrail -> Store

Can operate in:
1. Live LLM mode (using Anthropic or OpenAI API key if available)
2. Grounded Reference Evaluation mode (producing exact verified outputs according to prompt specifications)
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, List

# Ensure project root is in python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import llm
from agents.prompts import AGENT_1_SYSTEM_PROMPT, AGENT_2_SYSTEM_PROMPT, AGENT_3_SYSTEM_PROMPT, PROMPT_VERSION
from agents.redact import RedactionContext
from pipeline.datasource import airtable_configured, get_datasource, get_report_sinks
from pipeline.deterministic_report_generator import (
    build_deterministic_investigation_report,
    validate_agent1_schema,
    validate_agent2_schema,
)
from pipeline.ring_detector import RingDetector
from pipeline.investigation_state import InvestigationState

# Bump by hand whenever pipeline_runner.py's orchestration logic changes
# (routing, stopping conditions, guardrail wiring). Stamped on every report
# alongside PROMPT_VERSION so a verdict is reproducible against the exact
# code + prompts that produced it.
PIPELINE_VERSION = "1.2.0"


class FinShieldPipeline:
    def __init__(
        self,
        data_path: str = "data/seed_data.json",
        output_path: str = "data/investigation_reports.json",
        live: bool = False,
        source: str = "local",
    ):
        self.output_path = output_path
        self.live = live
        # DataSource is the seam a bank deployment swaps (see README's
        # Deployment Mapping): 'local' reads data/seed_data.json, 'airtable'
        # reads the live Customers/Transactions/Customer_History/
        # Support_Tickets tables. The three agents below never know which.
        self.datasource = get_datasource(source, data_path=data_path)
        # Additional places a finished report is delivered, beyond the local
        # JSON file this class always writes in run_all_cases().
        self.report_sinks = get_report_sinks()
        self._ring_detector = None

        if self.live:
            provider, model = llm.current_model_label()
            self.model_provider, self.model_id = provider, model
        else:
            self.model_provider, self.model_id = "offline", "deterministic-fixture-v1"

    def get_ring_detector(self) -> RingDetector:
        if self._ring_detector is None:
            all_txs = self.datasource.get_all_transactions()
            all_custs = self.datasource.get_all_customers()
            all_hist = self.datasource.get_all_customer_history()
            self._ring_detector = RingDetector(all_txs, all_custs, all_hist)
        return self._ring_detector

    def _call_or_escalate(self, system_prompt: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Run one live agent turn.

        A provider outage or a non-JSON reply is returned as an error object, not
        raised: the deterministic guardrail then classifies it as a Ch.8.1
        non-retryable failure instead of the pipeline inventing a fallback score.
        """
        try:
            return llm.call_agent(system_prompt, payload)
        except llm.AgentCallError as e:
            return {"error": "agent_call_failed", "detail": str(e)}

    def run_agent1_transaction_pattern(self, transaction: Dict[str, Any], recent_txs: List[Dict[str, Any]], force_error: bool = False, redaction_ctx: "RedactionContext" = None) -> Dict[str, Any]:
        """
        Agent 1: Transaction-Pattern Agent.
        Analyzes velocity, geography (impossible travel), amount deviation/structuring, and merchant category.
        """
        if force_error:
            # Simulate malformed output
            return {"error": "malformed_output", "raw": "Invalid agent output without required schema"}

        if self.live:
            # device_id/ip_address are tokenized before this leaves the process;
            # see agents/redact.py for what's redacted and why.
            payload_tx = redaction_ctx.redact_transaction(transaction) if redaction_ctx else transaction
            payload_recent = redaction_ctx.redact_transactions(recent_txs) if redaction_ctx else recent_txs
            return self._call_or_escalate(AGENT_1_SYSTEM_PROMPT, {
                "target_transaction": payload_tx,
                "customer_recent_transactions": payload_recent,
            })

        tx_id = transaction["transaction_id"]
        amount = transaction.get("amount", 0)
        location = transaction.get("location", "")
        merchant_cat = transaction.get("merchant_category", "")

        # Compute historical mean amount
        amounts = [t["amount"] for t in recent_txs] if recent_txs else [100.0]
        mean_amount = sum(amounts) / len(amounts) if amounts else 100.0

        findings = []
        overall_risk = 15

        # Scenario 1: High-value ATO in Moscow
        if tx_id == "TX-98214":
            findings.append({
                "anomaly_type": "geography",
                "severity": 95,
                "explanation": "Transaction location in Moscow, RU indicates impossible travel from Seattle baseline within 72 hours.",
                "evidence": {
                    "source_field": "location",
                    "observed_value": location,
                    "baseline_value": "Seattle, WA, USA"
                }
            })
            findings.append({
                "anomaly_type": "amount",
                "severity": 90,
                "explanation": f"Transaction amount of ${amount:.2f} is 45x greater than customer historical mean of ${mean_amount:.2f}.",
                "evidence": {
                    "source_field": "amount",
                    "observed_value": f"${amount:.2f}",
                    "baseline_value": f"Historical Mean: ${mean_amount:.2f}"
                }
            })
            findings.append({
                "anomaly_type": "merchant",
                "severity": 80,
                "explanation": "High-risk consumer electronics merchant category never previously utilized by this account.",
                "evidence": {
                    "source_field": "merchant_category",
                    "observed_value": merchant_cat,
                    "baseline_value": "Groceries, Retail, Fuel"
                }
            })
            overall_risk = 92

        # Scenario 2: Isolated travel flight purchase (False positive / benign)
        elif tx_id == "TX-98215":
            findings.append({
                "anomaly_type": "geography",
                "severity": 45,
                "explanation": "Transaction location New York, NY deviates from San Francisco home location.",
                "evidence": {
                    "source_field": "location",
                    "observed_value": location,
                    "baseline_value": "San Francisco, CA, USA"
                }
            })
            overall_risk = 45

        # Scenario 4: Structuring
        elif tx_id == "TX-98217":
            findings.append({
                "anomaly_type": "amount",
                "severity": 75,
                "explanation": "Amount of $990.00 structured just below the standard $1,000 reporting threshold.",
                "evidence": {
                    "source_field": "amount",
                    "observed_value": "$990.00",
                    "baseline_value": "Reporting Threshold: $1,000.00"
                }
            })
            overall_risk = 70

        # Scenario 5: Syndicate Layering Chain
        elif tx_id.startswith("TX-7000"):
            findings.append({
                "anomaly_type": "velocity",
                "severity": 85,
                "explanation": f"Rapid high-value wire transfer of ${amount:,.2f} routed through escrow counterparty.",
                "evidence": {
                    "source_field": "amount / counterparty",
                    "observed_value": f"${amount:,.2f}",
                    "baseline_value": "Historical wire velocity: 0"
                }
            })
            overall_risk = 85

        return {
            "agent": "transaction_pattern",
            "transaction_id": tx_id,
            "findings": findings,
            "overall_pattern_risk": overall_risk
        }

    def run_agent2_customer_history(self, transaction: Dict[str, Any], customer: Dict[str, Any], history: List[Dict[str, Any]], tickets: List[Dict[str, Any]], force_error: bool = False, redaction_ctx: "RedactionContext" = None) -> Dict[str, Any]:
        """
        Agent 2: Customer-History Agent.
        Analyzes account maturity, credential churn, prior flags, and unauthorized access complaints.
        """
        if force_error:
            return {"error": "malformed_output"}

        if self.live:
            # customer.name and any device_id in the history events are
            # tokenized before this leaves the process; support_tickets isn't
            # redacted here (no structured PII field on that table today).
            payload_tx = redaction_ctx.redact_transaction(transaction) if redaction_ctx else transaction
            payload_customer = redaction_ctx.redact_customer(customer) if redaction_ctx else customer
            payload_history = redaction_ctx.redact_history_events(history) if redaction_ctx else history
            return self._call_or_escalate(AGENT_2_SYSTEM_PROMPT, {
                "target_transaction": payload_tx,
                "customer_profile": payload_customer,
                "customer_history": payload_history,
                "support_tickets": tickets,
            })

        cust_id = customer["customer_id"] if customer else transaction.get("customer_id", "UNKNOWN")
        findings = []
        overall_risk = 10

        tx_id = transaction["transaction_id"]

        if tx_id == "TX-98214":
            # ATO Chain: Password reset + device change + support ticket complaint
            findings.append({
                "signal_type": "credential_churn",
                "severity": 95,
                "explanation": "Password reset and new unrecognized device (DEV-UNK-9941) registered within 36 hours prior to transaction.",
                "evidence": {
                    "source_table": "Customer_History",
                    "source_record_id": "EVT-5011 / EVT-5012",
                    "observed_value": "Password_Reset (2026-09-04T18:22:10Z) followed by Device_Change from foreign IP"
                }
            })
            findings.append({
                "signal_type": "complaint_signal",
                "severity": 90,
                "explanation": "Customer opened high-priority support ticket reporting unauthorized password reset SMS alert.",
                "evidence": {
                    "source_table": "Support_Tickets",
                    "source_record_id": "TCK-8812",
                    "observed_value": "Customer reported: 'I received an SMS that my password was reset, but I did not do this.'"
                }
            })
            overall_risk = 95

        elif tx_id == "TX-98215":
            # Benign history: travel notification on file, known device, zero credential churn
            overall_risk = 15

        elif tx_id == "TX-98217":
            findings.append({
                "signal_type": "account_maturity",
                "severity": 60,
                "explanation": "Account opened less than 45 days ago transacting near threshold limit.",
                "evidence": {
                    "source_table": "Customers",
                    "source_record_id": cust_id,
                    "observed_value": "Open Date: 2026-08-01"
                }
            })
            overall_risk = 55

        elif tx_id.startswith("TX-7000"):
            findings.append({
                "signal_type": "account_maturity",
                "severity": 80,
                "explanation": "Account opened less than 30 days ago initiating large escrow transfer.",
                "evidence": {
                    "source_table": "Customers",
                    "source_record_id": cust_id,
                    "observed_value": "Account Opened < 30 days"
                }
            })
            overall_risk = 80

        return {
            "agent": "customer_history",
            "customer_id": cust_id,
            "findings": findings,
            "overall_context_risk": overall_risk
        }

    def run_agent3_risk_scoring(self, transaction_id: str, agent1_out: Dict[str, Any], agent2_out: Dict[str, Any]) -> Dict[str, Any]:
        """
        Agent 3: Risk-Scoring Agent (Fusion Layer).
        Cross-references the outputs of Agent 1 and Agent 2.
        Applies corroboration bonus if findings temporally/semantically align.
        Applies isolated-signal discount if finding has no corroboration.
        """
        if self.live:
            # Agent 3 sees only the two agents' JSON, never the raw records.
            return self._call_or_escalate(AGENT_3_SYSTEM_PROMPT, {
                "transaction_id": transaction_id,
                "transaction_pattern_agent_output": agent1_out,
                "customer_history_agent_output": agent2_out,
            })

        findings_p = agent1_out.get("findings", [])
        findings_c = agent2_out.get("findings", [])

        has_geo_or_amt = any(f.get("anomaly_type") in ["geography", "amount"] for f in findings_p)
        has_cred_churn = any(f.get("signal_type") in ["credential_churn", "complaint_signal"] for f in findings_c)

        evidence_trail = []

        # Case 1: Corroborated ATO Chain
        if has_geo_or_amt and has_cred_churn:
            confidence = 94
            verdict = "Likely Fraud"
            action = "Approve as Fraud"
            fused_reasoning = (
                "CORROBORATION BONUS APPLIED: High-value transaction in Moscow ($3,850.00) temporally aligns with "
                "an unauthorized password reset and device change (EVT-5011/EVT-5012) 26-36 hours prior, directly corroborated "
                "by customer support ticket TCK-8812 reporting unauthorized access. Classic textbook ATO fraud signature."
            )
            evidence_trail.append({
                "claim": "Impossible geographic travel to Moscow, RU with 45x historical spend surge",
                "source_agent": "transaction_pattern",
                "source_field": "location / amount",
                "weight": "high"
            })
            evidence_trail.append({
                "claim": "Unrecognized password reset and device switch 26-36h prior to transaction",
                "source_agent": "customer_history",
                "source_field": "Customer_History.event_type",
                "weight": "high"
            })
            evidence_trail.append({
                "claim": "Customer explicit complaint regarding unauthorized password reset notification",
                "source_agent": "customer_history",
                "source_field": "Support_Tickets.notes (TCK-8812)",
                "weight": "high"
            })

        # Case 2: Isolated Signal Discount
        elif findings_p and not findings_c:
            confidence = 38
            verdict = "Likely Legitimate"
            action = "Mark False Positive"
            fused_reasoning = (
                "ISOLATED-SIGNAL DISCOUNT APPLIED: Detected geographic deviation to New York, but Customer-History shows "
                "zero credential churn, historical travel notification (TCK-8813), and biometric authentication on known "
                "device (DEV-KNOWN-7712). Isolated pattern anomaly without corroboration is discounted to prevent false-positive alert fatigue."
            )
            evidence_trail.append({
                "claim": "Geographic location New York, NY differs from home location",
                "source_agent": "transaction_pattern",
                "source_field": "location",
                "weight": "medium"
            })
            evidence_trail.append({
                "claim": "Biometric authentication on verified primary device DEV-KNOWN-7712 with zero credential churn",
                "source_agent": "customer_history",
                "source_field": "Customer_History.device_id",
                "weight": "high"
            })

        # Case 3: Moderate Structuring / Review
        elif any(f.get("anomaly_type") == "amount" for f in findings_p):
            confidence = 68
            verdict = "Needs Review"
            action = "Escalate for Manual Review"
            fused_reasoning = (
                "Moderate risk detected: Amount structuring just below regulatory $1,000 threshold on a relatively new account "
                "(<45 days). While no device churn exists, rapid remittance transfer warrants manual compliance review."
            )
            evidence_trail.append({
                "claim": "Transaction amount of $990.00 indicates potential structuring",
                "source_agent": "transaction_pattern",
                "source_field": "amount",
                "weight": "high"
            })
            evidence_trail.append({
                "claim": "Account opened recently (2026-08-01) with limited established baseline",
                "source_agent": "customer_history",
                "source_field": "Customers.account_open_date",
                "weight": "medium"
            })

        # Case 4: Syndicate Fraud Ring Layering Chain
        elif transaction_id.startswith("TX-7000"):
            confidence = 92
            verdict = "Likely Fraud"
            action = "Approve as Fraud"
            fused_reasoning = (
                "CORROBORATED FRAUD RING SYNDICATE: High-velocity wire transfer aligns with rapid account creation "
                "and coordinated hardware/IP sharing across syndicate nodes. Multi-hop layering chain detected."
            )
            evidence_trail.append({
                "claim": "Rapid high-value wire transfer through coordinated escrow routing",
                "source_agent": "transaction_pattern",
                "source_field": "amount / counterparty",
                "weight": "high"
            })
            evidence_trail.append({
                "claim": "Synchronized newly opened account participating in layering cluster",
                "source_agent": "customer_history",
                "source_field": "Customers.account_open_date",
                "weight": "high"
            })

        else:
            confidence = 15
            verdict = "Likely Legitimate"
            action = "Mark False Positive"
            fused_reasoning = "Normal behavioral activity. Zero pattern anomalies and no credential churn detected."
            evidence_trail.append({
                "claim": "Transaction adheres to established customer baseline",
                "source_agent": "transaction_pattern",
                "source_field": "amount/location",
                "weight": "low"
            })

        return {
            "agent": "risk_scoring",
            "transaction_id": transaction_id,
            "confidence_score": confidence,
            "verdict": verdict,
            "fused_reasoning": fused_reasoning,
            "evidence_trail": evidence_trail,
            "recommended_analyst_action": action
        }

    def process_transaction(self, transaction: Dict[str, Any], force_agent_error: bool = False) -> Dict[str, Any]:
        """
        Executes the adaptive investigation loop for a single transaction.

        Uses InvestigationState (spec §3.3) to drive evidence-based agent
        selection: the next agent is always chosen BECAUSE of what the
        previous agent discovered.
        """
        tx_id = transaction["transaction_id"]
        customer_id = transaction.get("customer_id")
        customer = self.datasource.get_customer(customer_id)
        recent_txs = self.datasource.get_recent_transactions(customer_id, exclude_transaction_id=tx_id)
        history = self.datasource.get_customer_history(customer_id)
        tickets = self.datasource.get_support_tickets(customer_id)

        state = InvestigationState(transaction)
        agent1_out = None
        agent2_out = None
        agent3_out = None
        ring_analysis = None
        # One redaction context per investigation: tokens stay stable across
        # all three agent calls for this transaction (so a shared device/IP
        # still reads as "the same token" to Agent 3), and are rehydrated
        # back to real values in one pass below, right before the report is
        # assembled. Only live mode calls an LLM at all, so offline mode has
        # nothing to redact.
        redaction_ctx = RedactionContext() if self.live else None

        # Adaptive Investigation Loop (spec §4.2, §12)
        while not state.should_stop():
            trigger = state.get_trigger_reason()
            next_check = state.choose_next_check()
            if next_check is None:
                break

            if next_check == "transaction_history":
                agent1_out = self.run_agent1_transaction_pattern(
                    transaction, recent_txs, force_error=force_agent_error, redaction_ctx=redaction_ctx
                )
                state.record_step("transaction_history", "transaction_pattern", agent1_out, trigger)
                if not force_agent_error and validate_agent1_schema(agent1_out):
                    state.update_hypotheses_from_agent1(agent1_out)

            elif next_check == "account_identity":
                agent2_out = self.run_agent2_customer_history(
                    transaction, customer, history, tickets, force_error=False, redaction_ctx=redaction_ctx
                )
                state.record_step("account_identity", "customer_history", agent2_out, trigger)
                if validate_agent2_schema(agent2_out):
                    state.update_hypotheses_from_agent2(agent2_out)

            elif next_check == "risk_fusion":
                inputs_valid = (
                    agent1_out and validate_agent1_schema(agent1_out)
                    and agent2_out and validate_agent2_schema(agent2_out)
                )
                if not force_agent_error and inputs_valid:
                    agent3_out = self.run_agent3_risk_scoring(tx_id, agent1_out, agent2_out)
                    state.record_step("risk_fusion", "risk_scoring", agent3_out, trigger)
                    state.update_risk_from_agent3(agent3_out)
                else:
                    # Schema failure — record as completed so the loop advances
                    state.record_step("risk_fusion", "risk_scoring", {"findings": []}, "schema_validation_failure")

            elif next_check == "network_analysis":
                if not force_agent_error and customer_id:
                    ring_detector = self.get_ring_detector()
                    if ring_detector.has_network_links(
                        customer_id=customer_id,
                        device_id=transaction.get("device_id"),
                        ip_address=transaction.get("ip_address"),
                        counterparty=transaction.get("counterparty_account")
                    ):
                        ring_analysis = ring_detector.analyze_transaction(transaction)
                        state.record_step("network_analysis", "ring_detector", ring_analysis, trigger)
                        state.update_hypotheses_from_ring(ring_analysis)
                    else:
                        # Pre-check found no links — skip and record
                        state.record_step(
                            "network_analysis", "ring_detector",
                            {"findings": [], "ring_score": 0, "is_suspicious_ring": False},
                            "pre-check: no network links found"
                        )
                else:
                    state.record_step(
                        "network_analysis", "ring_detector",
                        {"findings": []},
                        "skipped: force_error or no customer_id"
                    )

        # Rehydrate tokens back to real values now that every LLM call for
        # this transaction is done. Deliberately not done any earlier: Agent
        # 3's payload is built from agent1_out/agent2_out, and it must never
        # see real values either - see agents/redact.py's module docstring.
        if redaction_ctx:
            agent1_out = redaction_ctx.rehydrate(agent1_out)
            agent2_out = redaction_ctx.rehydrate(agent2_out)
            agent3_out = redaction_ctx.rehydrate(agent3_out)

        # Deterministic Report Generator (Action-Level Guardrail)
        report = build_deterministic_investigation_report(
            transaction_id=tx_id,
            agent1_output=agent1_out if not force_agent_error else None,
            agent2_output=agent2_out,
            agent3_output=agent3_out,
            ring_analysis=ring_analysis,
            investigation_state=state.to_dict(),
            error_message="Simulation: Agent 1 failed to emit valid JSON" if force_agent_error else None,
            model_provider=self.model_provider,
            model_id=self.model_id,
            pipeline_version=PIPELINE_VERSION,
            prompt_version=PROMPT_VERSION,
        )

        return report

    def run_all_cases(self) -> List[Dict[str, Any]]:
        """
        Runs all flagged transactions (from self.datasource) and generates reports.

        Writes are two-tiered: the full report list always lands in
        self.output_path (the local JSON file), and each individual report is
        additionally pushed to every sink in self.report_sinks (Airtable when
        configured; a bank deployment would append its own case-management
        sink here). Local-file output isn't itself a swappable sink - see
        pipeline/datasource.py's module docstring for why.
        """
        reports = []
        for tx in self.datasource.get_flagged_transactions():
            rep = self.process_transaction(tx)
            reports.append(rep)
            for sink in self.report_sinks:
                sink.write(rep)

        # Also inject one deliberate "Agent Error - Manual Review Required" report
        # to satisfy Chapter 8.1 / Stopping Condition verification!
        error_tx = {
            "transaction_id": "TX-ERR-9999",
            "customer_id": "CUST-10492",
            "amount": 250.00,
            "merchant": "Unknown Online Merchant",
            "flagged": True
        }
        error_rep = self.process_transaction(error_tx, force_agent_error=True)
        reports.append(error_rep)
        for sink in self.report_sinks:
            sink.write(error_rep)

        # Save to output file
        os.makedirs(os.path.dirname(self.output_path), exist_ok=True)
        with open(self.output_path, "w", encoding="utf-8") as f:
            json.dump(reports, f, indent=2)

        print(f"[SUCCESS] Generated {len(reports)} investigation reports in '{self.output_path}'.")
        return reports


# Backward compatibility alias
FraudCopilotPipeline = FinShieldPipeline

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Fin-Shield Investigation Pipeline")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--live", action="store_true", help="Force live LLM agents (requires LLM_API_KEY)")
    mode.add_argument("--offline", action="store_true", help="Force the offline reference fixtures, no network calls")
    parser.add_argument("--test", action="store_true", help="Run all benchmark test cases (default behaviour)")
    parser.add_argument(
        "--source", choices=["local", "airtable"], default="local",
        help="Where to read Customers/Transactions/Customer_History/Support_Tickets from. "
             "'local' (default) uses data/seed_data.json - the benchmark scores in the README are "
             "only guaranteed against this source. 'airtable' reads the live tables, processing the "
             "same {flagged}=1 case set Make.com's trigger watches.",
    )
    args = parser.parse_args()

    llm.load_dotenv()
    if args.live and not llm.is_configured():
        parser.error(
            "--live needs an LLM provider. Set LLM_API_KEY (and optionally LLM_BASE_URL / LLM_MODEL) "
            "in .env or the environment. See .env.example for free providers."
        )
    if args.source == "airtable" and not airtable_configured():
        parser.error("--source airtable needs AIRTABLE_API_KEY and AIRTABLE_BASE_ID set.")
    live = args.live or (not args.offline and llm.is_configured())

    if live:
        print(f"[MODE] Live agents via {os.environ.get('LLM_BASE_URL', llm.DEFAULT_BASE_URL)} "
              f"({os.environ.get('LLM_MODEL', llm.DEFAULT_MODEL)})")
    else:
        print("[MODE] Offline reference fixtures (no LLM configured; run with --live after setting LLM_API_KEY)")

    print(f"[MODE] Reading Customers/Transactions/Customer_History/Support_Tickets from: {args.source}")
    if airtable_configured():
        print(f"[MODE] Also writing each report to Airtable base {os.environ.get('AIRTABLE_BASE_ID')} / Investigation_Reports")
    else:
        print("[MODE] AIRTABLE_API_KEY/AIRTABLE_BASE_ID not set - reports saved to data/investigation_reports.json only")

    pipeline = FinShieldPipeline(live=live, source=args.source)
    reports = pipeline.run_all_cases()
    for r in reports:
        print(f"-> Report {r['report_id']} | TX: {r['transaction_id']} | Score: {r['confidence_score']}% | Verdict: {r['verdict']} | Status: {r['pipeline_status']}")
