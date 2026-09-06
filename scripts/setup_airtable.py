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

AIRTABLE_PAT = os.environ.get("AIRTABLE_API_KEY") or os.environ.get("AIRTABLE_PAT", "")
AIRTABLE_BASE_ID = os.environ.get("AIRTABLE_BASE_ID", "")

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
            {"name": "resolution_time_hrs", "type": "number", "options": {"precision": 1}}
        ]
    },
    {
        "name": "Investigation_Reports",
        "description": "Audit-ready investigation reports generated deterministically",
        "fields": [
            {"name": "report_id", "type": "singleLineText"},
            {"name": "transaction_id", "type": "singleLineText"},
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
            {"name": "evidence_trail", "type": "multilineText"},
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
            }
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

def create_table(base_id: str, table_def: Dict[str, Any]):
    url = f"https://api.airtable.com/v0/meta/bases/{base_id}/tables"
    print(f"Creating table '{table_def['name']}'...")
    make_airtable_request(url, method="POST", payload=table_def)
    print(f"[OK] Table '{table_def['name']}' created.")

def populate_seed_data(base_id: str, seed_data_path: str = "data/seed_data.json"):
    with open(seed_data_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Customers
    url = f"https://api.airtable.com/v0/{base_id}/Customers"
    records = [{"fields": c} for c in data.get("customers", [])]
    make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
    print(f"[OK] Seeded {len(records)} Customers.")

    # 2. Transactions
    url = f"https://api.airtable.com/v0/{base_id}/Transactions"
    records = [{"fields": t} for t in data.get("transactions", [])]
    make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
    print(f"[OK] Seeded {len(records)} Transactions.")

    # 3. Customer History
    url = f"https://api.airtable.com/v0/{base_id}/Customer_History"
    records = [{"fields": h} for h in data.get("customer_history", [])]
    make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
    print(f"[OK] Seeded {len(records)} Customer History events.")

    # 4. Support Tickets
    url = f"https://api.airtable.com/v0/{base_id}/Support_Tickets"
    records = [{"fields": s} for s in data.get("support_tickets", [])]
    make_airtable_request(url, method="POST", payload={"records": records, "typecast": True})
    print(f"[OK] Seeded {len(records)} Support Tickets.")

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

        print("\nPopulating benchmark seed data...")
        populate_seed_data(AIRTABLE_BASE_ID)
        print("\n[COMPLETE] Airtable Base successfully initialized and populated!")
    except Exception as e:
        print(f"[FAIL] Airtable provisioning error: {e}")

if __name__ == "__main__":
    main()
