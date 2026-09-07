"""
Airtable Schema and Seed Data Provisioner.
Sets up the 5 required tables and populates realistic benchmark seed records.

Requires:
  AIRTABLE_API_KEY (Personal Access Token with data.records:write and schema.bases:write scopes)
  AIRTABLE_BASE_ID (e.g. appXXXXXXXXXXXXXX)
"""

import os
import json
import urllib.request
import urllib.error
from typing import Dict, Any, List

def load_dotenv(path: str = ".env") -> None:
    if not os.path.exists(path):
        parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        if os.path.exists(parent_env):
            path = parent_env
        else:
            return
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip().strip("\"'"))

load_dotenv()

AIRTABLE_PAT = os.environ.get("AIRTABLE_API_KEY") or os.environ.get("AIRTABLE_PAT", "")
raw_base_id = os.environ.get("AIRTABLE_BASE_ID", "")
if raw_base_id == "app9jv5jY2fw9fp6":
    raw_base_id = "app9jv5jsY2fw9fp6"
AIRTABLE_BASE_ID = raw_base_id

TABLE_DEFINITIONS = [
    {
        "name": "Customers",
        "description": "Customer profiles, KYC tiers, and behavioral baseline statistics",
        "fields": [
            {"name": "customer_id", "type": "singleLineText"},
            {"name": "name", "type": "singleLineText"},
            {
                "name": "kyc_tier",
                "type": "singleSelect",
                "options": {"choices": [{"name": "Tier 1"}, {"name": "Tier 2"}, {"name": "Tier 3"}]}
            },
            {"name": "account_open_date", "type": "singleLineText"},
            {"name": "home_location", "type": "singleLineText"},
            {"name": "avg_monthly_spend", "type": "number", "options": {"precision": 2}},
            {"name": "preferred_merchants", "type": "multilineText"},
            {"name": "risk_flag_count_lifetime", "type": "number", "options": {"precision": 0}}
        ]
    },
    {
        "name": "Transactions",
        "description": "Monitored transactions with trigger flag for Make.com",
        "fields": [
            {"name": "transaction_id", "type": "singleLineText"},
            {"name": "customer_id", "type": "singleLineText"},
            {"name": "timestamp", "type": "singleLineText"},
            {"name": "amount", "type": "number", "options": {"precision": 2}},
            {"name": "merchant", "type": "singleLineText"},
            {"name": "merchant_category", "type": "singleLineText"},
            {"name": "location", "type": "singleLineText"},
            {"name": "device_id", "type": "singleLineText"},
            {"name": "ip_address", "type": "singleLineText"},
            {"name": "payment_method", "type": "singleLineText"},
            {
                "name": "status",
                "type": "singleSelect",
                "options": {"choices": [{"name": "Completed"}, {"name": "Pending"}, {"name": "Declined"}]}
            },
            {
                "name": "flagged",
                "type": "checkbox",
                "options": {"icon": "check", "color": "redBright"}
            }
        ]
    },
    {
        "name": "Customer_History",
        "description": "Episodic events (logins, credential resets, device changes, disputes)",
        "fields": [
            {"name": "event_id", "type": "singleLineText"},
            {"name": "customer_id", "type": "singleLineText"},
            {
                "name": "event_type",
                "type": "singleSelect",
                "options": {
                    "choices": [
                        {"name": "Login"},
                        {"name": "Password_Reset"},
                        {"name": "Device_Change"},
                        {"name": "Dispute"},
                        {"name": "Prior_Fraud_Flag"}
                    ]
                }
            },
            {"name": "event_timestamp", "type": "singleLineText"},
            {"name": "device_id", "type": "singleLineText"},
            {"name": "resolution", "type": "singleLineText"},
            {"name": "notes", "type": "multilineText"}
        ]
    },
    {
        "name": "Support_Tickets",
        "description": "Customer service tickets, complaints, and unauthorized access alerts",
        "fields": [
            {"name": "ticket_id", "type": "singleLineText"},
            {"name": "customer_id", "type": "singleLineText"},
            {"name": "category", "type": "singleLineText"},
            {
                "name": "sentiment",
                "type": "singleSelect",
                "options": {"choices": [{"name": "Negative"}, {"name": "Neutral"}, {"name": "Positive"}]}
            },
            {"name": "resolution_time_hrs", "type": "number", "options": {"precision": 1}},
            {"name": "notes", "type": "multilineText"}
        ]
    },
    {
        "name": "Investigation_Reports",
        "description": "Audit-ready investigation reports generated deterministically",
        "fields": [
            {"name": "report_id", "type": "singleLineText"},
            {"name": "transaction_id", "type": "singleLineText"},
            {"name": "summary", "type": "multilineText"},
            {"name": "confidence_score", "type": "number", "options": {"precision": 0}},
            {
                "name": "verdict",
                "type": "singleSelect",
                "options": {
                    "choices": [
                        {"name": "Likely Fraud"},
                        {"name": "Needs Review"},
                        {"name": "Likely Legitimate"}
                    ]
                }
            },
            {"name": "fused_reasoning", "type": "multilineText"},
            {"name": "evidence_trail", "type": "multilineText"},
            {"name": "recommended_action", "type": "singleLineText"},
            {"name": "agent1_output_json", "type": "multilineText"},
            {"name": "agent2_output_json", "type": "multilineText"},
            {"name": "agent3_output_json", "type": "multilineText"},
            {
                "name": "analyst_decision",
                "type": "singleSelect",
                "options": {
                    "choices": [
                        {"name": "Approved-Fraud"},
                        {"name": "False-Positive"},
                        {"name": "Escalated"}
                    ]
                }
            },
            {"name": "analyst_notes", "type": "multilineText"},
            {"name": "closed_by", "type": "singleLineText"},
            {"name": "closed_at", "type": "singleLineText"},
            {"name": "created_at", "type": "singleLineText"},
            {
                "name": "pipeline_status",
                "type": "singleSelect",
                "options": {
                    "choices": [
                        {"name": "Pending Analyst Review"},
                        {"name": "Agent Error - Manual Review Required"},
                        {"name": "Closed"}
                    ]
                }
            },
            # Provenance (Ch.9.4 Runtime Monitoring extension): which model and
            # which version of the pipeline/prompts produced this verdict, so
            # it's reproducible against the exact code that made it months later.
            {"name": "model_provider", "type": "singleLineText"},
            {"name": "model_id", "type": "singleLineText"},
            {"name": "pipeline_version", "type": "singleLineText"},
            {"name": "prompt_version", "type": "singleLineText"}
        ]
    }
]

def make_airtable_request(url: str, method: str = "GET", payload: Dict[str, Any] = None) -> Dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {AIRTABLE_PAT}",
        "Content-Type": "application/json"
    }
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        print(f"[ERROR] Airtable API request failed: {e.code} {e.reason} -> {err_body}")
        raise

def get_existing_tables(base_id: str) -> List[str]:
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    resp = make_airtable_request(url)
    return [t["name"] for t in resp.get("tables", [])]

def get_existing_tables_with_fields(base_id: str) -> Dict[str, Dict[str, Any]]:
    """{table_name: {"id": tableId, "fields": [field_name, ...]}} - used to add
    missing columns to an already-provisioned table without touching existing data."""
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    resp = make_airtable_request(url)
    return {
        t["name"]: {"id": t["id"], "fields": [f["name"] for f in t["fields"]]}
        for t in resp.get("tables", [])
    }

def create_table(base_id: str, table_def: Dict[str, Any]):
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    print(f"Creating table '{table_def['name']}'...")
    make_airtable_request(url, method="POST", payload=table_def)
    print(f"[OK] Table '{table_def['name']}' created.")

def ensure_fields(base_id: str, table_id: str, table_name: str, field_defs: List[Dict[str, Any]], existing_field_names: List[str]):
    """Idempotent: adds any field in field_defs missing from existing_field_names.
    Never removes or modifies an existing field - safe to run repeatedly against
    a live base that already has data in it."""
    for fd in field_defs:
        if fd["name"] in existing_field_names:
            continue
        url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables/{table_id}/fields"
        print(f"Adding field '{fd['name']}' to '{table_name}'...")
        make_airtable_request(url, method="POST", payload=fd)
        print(f"[OK] Field '{fd['name']}' added to '{table_name}'.")

def get_record_count(base_id: str, table_name: str) -> int:
    try:
        url = f"https://api.airtable.com/v0/{base_id}/{table_name}?maxRecords=1"
        resp = make_airtable_request(url)
        return len(resp.get("records", []))
    except Exception:
        return 0

def populate_seed_data(base_id: str, seed_data_path: str = "data/seed_data.json"):
    with open(seed_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Customers
    if get_record_count(base_id, "Customers") == 0:
        url = f"https://api.airtable.com/v0/{base_id}/Customers"
        records = [{"fields": c} for c in data.get("customers", [])]
        make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
        print(f"[OK] Seeded {len(records)} Customers.")
    else:
        print("[SKIP] Customers table already contains records.")

    # 2. Transactions
    if get_record_count(base_id, "Transactions") == 0:
        url = f"https://api.airtable.com/v0/{base_id}/Transactions"
        records = [{"fields": t} for t in data.get("transactions", [])]
        make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
        print(f"[OK] Seeded {len(records)} Transactions.")
    else:
        print("[SKIP] Transactions table already contains records.")

    # 3. Customer History
    if get_record_count(base_id, "Customer_History") == 0:
        url = f"https://api.airtable.com/v0/{base_id}/Customer_History"
        records = [{"fields": h} for h in data.get("customer_history", [])]
        make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
        print(f"[OK] Seeded {len(records)} Customer History events.")
    else:
        print("[SKIP] Customer_History table already contains records.")

    # 4. Support Tickets
    if get_record_count(base_id, "Support_Tickets") == 0:
        url = f"https://api.airtable.com/v0/{base_id}/Support_Tickets"
        records = [{"fields": s} for s in data.get("support_tickets", [])]
        make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
        print(f"[OK] Seeded {len(records)} Support Tickets.")
    else:
        print("[SKIP] Support_Tickets table already contains records.")

    # 5. Investigation Reports
    reports_path = os.path.join(os.path.dirname(seed_data_path), "investigation_reports.json")
    if os.path.exists(reports_path) and get_record_count(base_id, "Investigation_Reports") == 0:
        with open(reports_path, "r", encoding="utf-8") as rf:
            reports_data = json.load(rf)
        records = []
        for r in reports_data:
            fields = {
                "report_id": r.get("report_id"),
                "transaction_id": r.get("transaction_id"),
                "summary": r.get("summary"),
                "confidence_score": r.get("confidence_score"),
                "verdict": r.get("verdict"),
                "fused_reasoning": r.get("fused_reasoning"),
                "evidence_trail": json.dumps(r.get("evidence_trail", [])),
                "recommended_action": r.get("recommended_action"),
                "pipeline_status": r.get("pipeline_status"),
                "agent1_output_json": r.get("agent1_output_json", "{}"),
                "agent2_output_json": r.get("agent2_output_json", "{}"),
                "agent3_output_json": r.get("agent3_output_json", "{}"),
                "created_at": r.get("created_at")
            }
            if r.get("analyst_decision"):
                fields["analyst_decision"] = r.get("analyst_decision")
            if r.get("analyst_notes"):
                fields["analyst_notes"] = r.get("analyst_notes")
            if r.get("closed_by"):
                fields["closed_by"] = r.get("closed_by")
            if r.get("closed_at"):
                fields["closed_at"] = r.get("closed_at")
            records.append({"fields": fields})
        url = f"https://api.airtable.com/v0/{base_id}/Investigation_Reports"
        make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
        print(f"[OK] Seeded {len(records)} Investigation Reports.")
    else:
        print("[SKIP] Investigation_Reports table already contains records (or seed file not found).")

def main():
    if not AIRTABLE_PAT or not AIRTABLE_BASE_ID:
        print("\n=======================================================")
        print(" [AIRTABLE CONFIGURATION REQUIRED]")
        print(" To provision your Airtable base automatically, provide:")
        print("   export AIRTABLE_API_KEY='patXXXXXXXXXXXX'")
        print("   export AIRTABLE_BASE_ID='appXXXXXXXXXXXX'")
        print(" (Or add them to .env)")
        print("=======================================================\n")
        return

    print(f"Connecting to Airtable base '{AIRTABLE_BASE_ID}'...")
    try:
        existing = get_existing_tables(AIRTABLE_BASE_ID)
        print(f"Found existing tables: {existing}")
        for t_def in TABLE_DEFINITIONS:
            if t_def["name"] not in existing:
                create_table(AIRTABLE_BASE_ID, t_def)
            else:
                print(f"Table '{t_def['name']}' already exists.")

        # Re-fetch (a table just created above won't be in the earlier
        # name-only listing) and add any field defined above but missing from
        # a table that already existed - e.g. provenance columns added to
        # Investigation_Reports after the base was first provisioned.
        print("\nChecking for missing fields on existing tables...")
        existing_with_fields = get_existing_tables_with_fields(AIRTABLE_BASE_ID)
        for t_def in TABLE_DEFINITIONS:
            info = existing_with_fields.get(t_def["name"])
            if not info:
                continue
            ensure_fields(AIRTABLE_BASE_ID, info["id"], t_def["name"], t_def["fields"], info["fields"])

        print("\nPopulating benchmark seed data...")
        populate_seed_data(AIRTABLE_BASE_ID)
        print("\n[COMPLETE] Airtable Base successfully initialized and populated!")
    except Exception as e:
        print(f"[FAIL] Airtable provisioning error: {e}")

if __name__ == "__main__":
    main()
