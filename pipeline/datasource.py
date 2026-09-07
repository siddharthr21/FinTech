"""
Data access layer for the Multi-Agent Fraud Investigation Copilot.

This is the seam a real deployment swaps. LocalJSONDataSource stands in for
a bank's core banking system (CBS) during development; AirtableDataSource
proves the same interface works against a live external system instead of a
bundled fixture file. A production integration implements DataSource against
the bank's own read-only replica/view of Customers/Transactions/Customer_
History/Support_Tickets - the three agents and the fusion logic in
pipeline_runner.py never change, only this file does. See the README's
"Deployment Mapping" section for the full picture.

The write side mirrors this: ReportSink is where a finished Investigation
Report goes. AirtableReportSink is the only implementation today (the local
data/investigation_reports.json file is written directly by
FinShieldPipeline.run_all_cases, not through a sink - see the docstring
there). A bank's case-management system would add its own ReportSink
alongside it, not replace it.
"""

import http.client
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


def _escape_formula_value(value: str) -> str:
    """Escape a value for interpolation into an Airtable filterByFormula
    string literal (mirrors lib/airtable.ts's escapeFormulaValue)."""
    return value.replace("\\", "\\\\").replace("'", "\\'")


def airtable_configured() -> bool:
    return bool(os.environ.get("AIRTABLE_API_KEY") and os.environ.get("AIRTABLE_BASE_ID"))


class DataSource(ABC):
    """Read-only access to customer/transaction/history/ticket records.

    A bank integration implements this against a read-only DB view or
    replica the DBA team grants - never against production write tables.
    """

    @abstractmethod
    def get_flagged_transactions(self) -> List[Dict[str, Any]]:
        """Transactions an upstream rules engine has already flagged for investigation."""

    @abstractmethod
    def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_recent_transactions(self, customer_id: str, exclude_transaction_id: Optional[str] = None) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_customer_history(self, customer_id: str) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_support_tickets(self, customer_id: str) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_all_transactions(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_all_customers(self) -> List[Dict[str, Any]]:
        ...

    @abstractmethod
    def get_all_customer_history(self) -> List[Dict[str, Any]]:
        ...


class ReportSink(ABC):
    """Where a finished Investigation Report is delivered, beyond the local
    JSON file the pipeline always writes."""

    @abstractmethod
    def write(self, report: Dict[str, Any]) -> None:
        ...


class LocalJSONDataSource(DataSource):
    """Reads from the bundled data/seed_data.json fixture file. This is what
    every benchmark score in the README and pipeline/test_pipeline.py is
    computed against - keep it as the default."""

    def __init__(self, data_path: str = "data/seed_data.json"):
        self.data_path = data_path
        self.data = self._load()

    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.data_path):
            with open(self.data_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return {"customers": [], "transactions": [], "recent_transactions": [], "customer_history": [], "support_tickets": []}

    def get_flagged_transactions(self) -> List[Dict[str, Any]]:
        return [t for t in self.data.get("transactions", []) if t.get("flagged")]

    def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        for c in self.data.get("customers", []):
            if c["customer_id"] == customer_id:
                return c
        return None

    def get_recent_transactions(self, customer_id: str, exclude_transaction_id: Optional[str] = None) -> List[Dict[str, Any]]:
        # seed_data.json curates a separate recent_transactions list per
        # customer, so there is nothing to exclude here (unlike Airtable's
        # version, which derives "recent" from the same Transactions table).
        return [t for t in self.data.get("recent_transactions", []) if t["customer_id"] == customer_id]

    def get_customer_history(self, customer_id: str) -> List[Dict[str, Any]]:
        return [h for h in self.data.get("customer_history", []) if h["customer_id"] == customer_id]

    def get_support_tickets(self, customer_id: str) -> List[Dict[str, Any]]:
        return [t for t in self.data.get("support_tickets", []) if t["customer_id"] == customer_id]

    def get_all_transactions(self) -> List[Dict[str, Any]]:
        return self.data.get("transactions", [])

    def get_all_customers(self) -> List[Dict[str, Any]]:
        return self.data.get("customers", [])

    def get_all_customer_history(self) -> List[Dict[str, Any]]:
        return self.data.get("customer_history", [])


class AirtableDataSource(DataSource):
    """Reads Customers/Transactions/Customer_History/Support_Tickets directly
    from Airtable instead of the bundled JSON fixture.

    This proves the DataSource seam works against a live external system,
    not only a local file - a bank's adapter follows the same shape, reading
    from a read-only CBS view instead of Airtable's REST API.
    get_flagged_transactions() uses the identical filter formula Make.com's
    trigger watches ({flagged} = 1), so running the Python pipeline with
    this source processes exactly the case set Make.com would push - as a
    pull/batch run instead of a push/streaming trigger.

    Note: Airtable has no separate "recent transactions" table, so
    get_recent_transactions derives it from Transactions filtered by
    customer, excluding the case's own transaction. That is a more
    realistic shape for a real bank integration than the JSON fixture's
    artificially separate list.
    """

    def __init__(self, api_key: str, base_id: str):
        self.api_key = api_key
        self.base_id = base_id

    def _records(self, table: str, formula: Optional[str] = None) -> List[Dict[str, Any]]:
        url = f"https://api.airtable.com/v0/{self.base_id}/{urllib.parse.quote(table)}"
        if formula:
            url += f"?filterByFormula={urllib.parse.quote(formula)}"
        req = urllib.request.Request(url, headers={"Authorization": f"Bearer {self.api_key}"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode("utf-8")).get("records", [])

    def get_flagged_transactions(self) -> List[Dict[str, Any]]:
        return [r["fields"] for r in self._records("Transactions", "{flagged} = 1")]

    def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        recs = self._records("Customers", f"{{customer_id}}='{_escape_formula_value(customer_id)}'")
        return recs[0]["fields"] if recs else None

    def get_recent_transactions(self, customer_id: str, exclude_transaction_id: Optional[str] = None) -> List[Dict[str, Any]]:
        recs = self._records("Transactions", f"{{customer_id}}='{_escape_formula_value(customer_id)}'")
        txs = [r["fields"] for r in recs]
        if exclude_transaction_id:
            txs = [t for t in txs if t.get("transaction_id") != exclude_transaction_id]
        return txs

    def get_customer_history(self, customer_id: str) -> List[Dict[str, Any]]:
        recs = self._records("Customer_History", f"{{customer_id}}='{_escape_formula_value(customer_id)}'")
        return [r["fields"] for r in recs]

    def get_support_tickets(self, customer_id: str) -> List[Dict[str, Any]]:
        recs = self._records("Support_Tickets", f"{{customer_id}}='{_escape_formula_value(customer_id)}'")
        return [r["fields"] for r in recs]

    def get_all_transactions(self) -> List[Dict[str, Any]]:
        return [r["fields"] for r in self._records("Transactions")]

    def get_all_customers(self) -> List[Dict[str, Any]]:
        return [r["fields"] for r in self._records("Customers")]

    def get_all_customer_history(self) -> List[Dict[str, Any]]:
        return [r["fields"] for r in self._records("Customer_History")]


class AirtableReportSink(ReportSink):
    """Writes a finished report to Airtable's Investigation_Reports table.

    Mirrors the Make.com scenario's 'Store Investigation Report' step (Ch.9.4
    Runtime Monitoring), so a --live/--offline pipeline run leaves the same
    audit trail the Make.com trigger path writes to.

    Never raises: a monitoring-sink outage must not take down the
    investigation itself. data/investigation_reports.json is always written
    by the pipeline regardless of whether this succeeds; a failure here only
    prints a warning.
    """

    def __init__(self, api_key: str, base_id: str):
        self.api_key = api_key
        self.base_id = base_id

    def write(self, report: Dict[str, Any]) -> None:
        # Field names/types match scripts/setup_airtable.py's TABLE_DEFINITIONS
        # for Investigation_Reports. analyst_decision/analyst_notes/closed_by/
        # closed_at are optional and omitted entirely (not sent as null) when
        # unset, matching that script's seeding logic.
        fields = {
            "report_id": report["report_id"],
            "transaction_id": report["transaction_id"],
            "summary": report["summary"],
            "confidence_score": report["confidence_score"],
            "verdict": report["verdict"],
            "fused_reasoning": report["fused_reasoning"],
            "evidence_trail": json.dumps(report.get("evidence_trail", [])),
            "recommended_action": report["recommended_action"],
            "pipeline_status": report["pipeline_status"],
            "agent1_output_json": report.get("agent1_output_json", "{}"),
            "agent2_output_json": report.get("agent2_output_json", "{}"),
            "agent3_output_json": report.get("agent3_output_json", "{}"),
            "created_at": report["created_at"],
        }
        for optional_field in ("analyst_decision", "analyst_notes", "closed_by", "closed_at",
                                "model_provider", "model_id", "pipeline_version", "prompt_version"):
            if report.get(optional_field):
                fields[optional_field] = report[optional_field]

        url = f"https://api.airtable.com/v0/{self.base_id}/Investigation_Reports"
        body = json.dumps({"records": [{"fields": fields}], "typecast": True}).encode("utf-8")
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}

        for attempt in range(3):
            req = urllib.request.Request(url, data=body, headers=headers, method="POST")
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    json.loads(resp.read().decode("utf-8"))
                print(f"[Airtable] Wrote {report['report_id']} to Investigation_Reports.")
                return
            except urllib.error.HTTPError as e:
                detail = e.read().decode("utf-8", "replace")[:300]
                if e.code == 429 and attempt < 2:
                    time.sleep(2)
                    continue
                print(f"[Airtable] WARNING: failed to write {report['report_id']} (HTTP {e.code}): {detail}")
                return
            except (OSError, http.client.HTTPException) as e:
                print(f"[Airtable] WARNING: could not reach Airtable for {report['report_id']}: {e}")
                return


def get_datasource(source: str, data_path: str = "data/seed_data.json") -> DataSource:
    """source: 'local' (default) or 'airtable'. 'auto' picks Airtable when
    configured, local otherwise - used by --source auto / the CLI default."""
    if source == "auto":
        source = "airtable" if airtable_configured() else "local"
    if source == "airtable":
        if not airtable_configured():
            raise RuntimeError("AIRTABLE_API_KEY/AIRTABLE_BASE_ID not set - cannot use --source airtable.")
        return AirtableDataSource(os.environ["AIRTABLE_API_KEY"], os.environ["AIRTABLE_BASE_ID"])
    return LocalJSONDataSource(data_path)


def get_report_sinks() -> List[ReportSink]:
    """Additional places (beyond the local JSON file) a finished report is
    delivered. A bank deployment appends its own case-management sink here."""
    if airtable_configured():
        return [AirtableReportSink(os.environ["AIRTABLE_API_KEY"], os.environ["AIRTABLE_BASE_ID"])]
    return []
