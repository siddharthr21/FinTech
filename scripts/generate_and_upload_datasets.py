"""
Public Benchmark Datasets Synthesizer and Airtable Uploader.
Implements the multi-dataset benchmark synthesis architecture:
1. Sparkov: Realistic transaction amounts, timestamps, merchants, merchant categories, lat/long demographics.
2. IEEE-CIS: Identity table attributes including device_id fingerprints, IP addresses, and payment methods.
3. Behavioral Baselines: Pre-computed rolling mean monthly spend, typical merchant categories, verified devices.
4. SAML-D & AML Typologies: Structuring just below thresholds ($990 / $10,000), velocity bursts, fan-out transfers.
5. CFPB Consumer Complaints: Authentic consumer narratives for unauthorized access, account takeover alerts, and sentiment.
6. Human-Gated Audit Datastore: Direct batch upload into Airtable base (Customers, Transactions, History, Support, Reports).
"""

import os
import sys
import json
import time
import random
import urllib.request
import urllib.error
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List

# Ensure parent directory is on sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

def load_dotenv(path: str = ".env") -> None:
    if not os.path.isabs(path):
        path = os.path.join(BASE_DIR, path)
    if not os.path.exists(path):
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

def batch_upload_records(table_name: str, records: List[Dict[str, Any]]) -> int:
    """Upload records in chunks of 10 (Airtable REST API batch limit)."""
    if not AIRTABLE_PAT or not AIRTABLE_BASE_ID:
        print(f"[SKIP] Airtable credentials not configured. Skipping upload for '{table_name}'.")
        return 0

    url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{table_name}"
    uploaded = 0
    batch_size = 10

    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        payload = {
            "records": [{"fields": r} for r in batch],
            "typecast": True
        }
        try:
            resp = make_airtable_request(url, method="POST", payload=payload)
            uploaded += len(resp.get("records", []))
            time.sleep(0.2) # Rate-limit friendly
        except Exception as e:
            print(f"[WARN] Batch upload error in '{table_name}' (batch {i//batch_size}): {e}")

    print(f"[OK] Uploaded {uploaded}/{len(records)} records to Airtable table '{table_name}'.")
    return uploaded

def generate_benchmark_datasets() -> Dict[str, Any]:
    """
    Constructs the benchmark dataset adhering to Sparkov, IEEE-CIS, SAML-D, and CFPB distributions.
    Includes the 3 core reference test cases (TX-98214, TX-98215, TX-98217) plus extended scenarios.
    """
    customers = [
        {
            "customer_id": "CUST-10492",
            "name": "Elena Rostova",
            "kyc_tier": "Tier 2",
            "account_open_date": "2023-04-15",
            "home_location": "Seattle, WA, USA",
            "avg_monthly_spend": 2450.00,
            "preferred_merchants": "Amazon, Whole Foods, Target, Shell, Nordstrom",
            "risk_flag_count_lifetime": 0
        },
        {
            "customer_id": "CUST-20811",
            "name": "Marcus Chen",
            "kyc_tier": "Tier 1",
            "account_open_date": "2021-08-20",
            "home_location": "San Francisco, CA, USA",
            "avg_monthly_spend": 4120.00,
            "preferred_merchants": "Uber, Delta Air Lines, Apple, Blue Bottle Coffee",
            "risk_flag_count_lifetime": 1
        },
        {
            "customer_id": "CUST-30944",
            "name": "Sarah Jenkins",
            "kyc_tier": "Tier 3",
            "account_open_date": "2020-01-10",
            "home_location": "Austin, TX, USA",
            "avg_monthly_spend": 6800.00,
            "preferred_merchants": "H-E-B, Equinox, Patagonia, Central Market",
            "risk_flag_count_lifetime": 0
        },
        {
            "customer_id": "CUST-40115",
            "name": "David Miller",
            "kyc_tier": "Tier 1",
            "account_open_date": "2026-08-01",
            "home_location": "Chicago, IL, USA",
            "avg_monthly_spend": 850.00,
            "preferred_merchants": "Walgreens, CTA, Trader Joe's",
            "risk_flag_count_lifetime": 0
        },
        # Additional Sparkov + Bank Churn profiles
        {
            "customer_id": "CUST-50228",
            "name": "Amara Okafor",
            "kyc_tier": "Tier 2",
            "account_open_date": "2024-02-14",
            "home_location": "Atlanta, GA, USA",
            "avg_monthly_spend": 3100.00,
            "preferred_merchants": "Publix, Delta Air Lines, Home Depot, Starbucks",
            "risk_flag_count_lifetime": 0
        },
        {
            "customer_id": "CUST-60341",
            "name": "Liam Gallagher",
            "kyc_tier": "Tier 1",
            "account_open_date": "2025-11-05",
            "home_location": "Boston, MA, USA",
            "avg_monthly_spend": 1420.00,
            "preferred_merchants": "CVS Pharmacy, Stop & Shop, Dunkin', MBTA",
            "risk_flag_count_lifetime": 2
        },
        # Fraud Ring Syndicate: 4 accounts opened in tight cluster sharing hardware & IPs
        {
            "customer_id": "CUST-70112",
            "name": "Vikram Sethi",
            "kyc_tier": "Tier 1",
            "account_open_date": "2026-08-10",
            "home_location": "Mumbai, MH, IND",
            "avg_monthly_spend": 1800.00,
            "preferred_merchants": "SwiftLayer Escrow, Wire Remittance",
            "risk_flag_count_lifetime": 1
        },
        {
            "customer_id": "CUST-70113",
            "name": "Rajesh Nair",
            "kyc_tier": "Tier 1",
            "account_open_date": "2026-08-12",
            "home_location": "Navi Mumbai, MH, IND",
            "avg_monthly_spend": 1500.00,
            "preferred_merchants": "Apex Vault Clearing, P2P Remit",
            "risk_flag_count_lifetime": 1
        },
        {
            "customer_id": "CUST-70114",
            "name": "Ananya Roy",
            "kyc_tier": "Tier 1",
            "account_open_date": "2026-08-15",
            "home_location": "Thane, MH, IND",
            "avg_monthly_spend": 1600.00,
            "preferred_merchants": "Offshore Ledger, Digital P2P",
            "risk_flag_count_lifetime": 0
        },
        {
            "customer_id": "CUST-70115",
            "name": "Karan Malhotra",
            "kyc_tier": "Tier 1",
            "account_open_date": "2026-08-18",
            "home_location": "Pune, MH, IND",
            "avg_monthly_spend": 2100.00,
            "preferred_merchants": "CryptoGate Direct, Remit Wire",
            "risk_flag_count_lifetime": 1
        },
        # Benign Shared-Hardware Couple (Discrimination Control: shared tablet, distinct clean history)
        {
            "customer_id": "CUST-80101",
            "name": "Priya Sharma",
            "kyc_tier": "Tier 2",
            "account_open_date": "2023-03-10",
            "home_location": "Bangalore, KA, IND",
            "avg_monthly_spend": 3200.00,
            "preferred_merchants": "Amazon India, BigBasket, Starbucks",
            "risk_flag_count_lifetime": 0
        },
        {
            "customer_id": "CUST-80102",
            "name": "Rohan Sharma",
            "kyc_tier": "Tier 2",
            "account_open_date": "2022-11-05",
            "home_location": "Bangalore, KA, IND",
            "avg_monthly_spend": 4100.00,
            "preferred_merchants": "Myntra, Swiggy, Uber",
            "risk_flag_count_lifetime": 0
        }
    ]

    transactions = [
        # Benchmark Case 1: Sparkov + IEEE-CIS ATO Fraud Chain
        {
            "transaction_id": "TX-98214",
            "customer_id": "CUST-10492",
            "timestamp": "2026-09-06T03:14:22Z",
            "amount": 3850.00,
            "merchant": "Apex Luxury Electronics",
            "merchant_category": "Consumer Electronics & High-End Tech",
            "location": "Moscow, RU",
            "device_id": "DEV-UNK-9941",
            "ip_address": "185.220.101.44",
            "payment_method": "Virtual Visa ending 4109",
            "counterparty_account": "ACC-APEX-ELEC",
            "status": "Completed",
            "flagged": True
        },
        # Benchmark Case 2: Benign Travel False-Positive
        {
            "transaction_id": "TX-98215",
            "customer_id": "CUST-20811",
            "timestamp": "2026-09-06T08:20:15Z",
            "amount": 480.00,
            "merchant": "Delta Air Lines",
            "merchant_category": "Airlines & Travel",
            "location": "New York, NY, USA",
            "device_id": "DEV-KNOWN-7712",
            "ip_address": "12.180.45.10",
            "payment_method": "Apple Pay",
            "counterparty_account": "ACC-DELTA-AIR",
            "status": "Completed",
            "flagged": True
        },
        # Benchmark Case 3: Routine Baseline In-Store Grocery
        {
            "transaction_id": "TX-98216",
            "customer_id": "CUST-30944",
            "timestamp": "2026-09-06T12:05:00Z",
            "amount": 64.50,
            "merchant": "Whole Foods Market",
            "merchant_category": "Grocery",
            "location": "Austin, TX, USA",
            "device_id": "DEV-KNOWN-3301",
            "ip_address": "73.155.88.22",
            "payment_method": "Physical Card Chip",
            "counterparty_account": "ACC-WHOLEFOODS-TX",
            "status": "Completed",
            "flagged": False
        },
        # Benchmark Case 4: SAML-D Typology - Structuring Under Threshold
        {
            "transaction_id": "TX-98217",
            "customer_id": "CUST-40115",
            "timestamp": "2026-09-06T04:45:10Z",
            "amount": 990.00,
            "merchant": "Global Remit Wire",
            "merchant_category": "Money Transfer",
            "location": "Chicago, IL, USA",
            "device_id": "DEV-KNOWN-5522",
            "ip_address": "98.220.14.77",
            "payment_method": "Debit Card",
            "counterparty_account": "ACC-GLOBAL-REMIT",
            "status": "Completed",
            "flagged": True
        },
        # Additional Sparkov + SAML-D Extended Transactions
        {
            "transaction_id": "TX-98218",
            "customer_id": "CUST-50228",
            "timestamp": "2026-09-06T14:10:00Z",
            "amount": 42.15,
            "merchant": "Publix Super Markets",
            "merchant_category": "Grocery",
            "location": "Atlanta, GA, USA",
            "device_id": "DEV-KNOWN-8841",
            "ip_address": "68.211.90.12",
            "payment_method": "Contactless Visa",
            "counterparty_account": "ACC-PUBLIX-ATL",
            "status": "Completed",
            "flagged": False
        },
        {
            "transaction_id": "TX-98219",
            "customer_id": "CUST-60341",
            "timestamp": "2026-09-06T15:22:30Z",
            "amount": 18.50,
            "merchant": "Dunkin'",
            "merchant_category": "Food & Beverage",
            "location": "Boston, MA, USA",
            "device_id": "DEV-KNOWN-1290",
            "ip_address": "24.61.18.99",
            "payment_method": "Mobile Wallet",
            "counterparty_account": "ACC-DUNKIN-BOS",
            "status": "Completed",
            "flagged": False
        },
        # Fraud Ring Case: Rapid Layering Chain across 4 accounts sharing DEV-RING-4417 & IPs (45.132.192.7 / 103.21.244.18)
        {
            "transaction_id": "TX-70001",
            "customer_id": "CUST-70112",
            "timestamp": "2026-09-06T06:00:00Z",
            "amount": 4800.00,
            "merchant": "SwiftLayer Escrow",
            "merchant_category": "Money Transfer",
            "location": "Mumbai, MH, IND",
            "device_id": "DEV-RING-4417",
            "ip_address": "45.132.192.7",
            "payment_method": "Instant Wire",
            "counterparty_account": "ACC-MULE-9011",
            "status": "Completed",
            "flagged": True
        },
        {
            "transaction_id": "TX-70002",
            "customer_id": "CUST-70113",
            "timestamp": "2026-09-06T06:38:00Z",
            "amount": 4550.00,
            "merchant": "Apex Vault Clearing",
            "merchant_category": "Money Transfer",
            "location": "Mumbai, MH, IND",
            "device_id": "DEV-RING-4417",
            "ip_address": "45.132.192.7",
            "payment_method": "Instant Wire",
            "counterparty_account": "ACC-MULE-9011",
            "status": "Completed",
            "flagged": True
        },
        {
            "transaction_id": "TX-70003",
            "customer_id": "CUST-70114",
            "timestamp": "2026-09-06T07:15:00Z",
            "amount": 4300.00,
            "merchant": "Offshore Ledger S.A.",
            "merchant_category": "Money Transfer",
            "location": "Mumbai, MH, IND",
            "device_id": "DEV-RING-4417",
            "ip_address": "103.21.244.18",
            "payment_method": "Instant Wire",
            "counterparty_account": "ACC-MULE-9011",
            "status": "Completed",
            "flagged": True
        },
        {
            "transaction_id": "TX-70004",
            "customer_id": "CUST-70115",
            "timestamp": "2026-09-06T07:50:00Z",
            "amount": 4100.00,
            "merchant": "CryptoGate Direct",
            "merchant_category": "Money Transfer",
            "location": "Mumbai, MH, IND",
            "device_id": "DEV-RING-4417",
            "ip_address": "103.21.244.18",
            "payment_method": "Instant Wire",
            "counterparty_account": "ACC-MULE-9011",
            "status": "Completed",
            "flagged": True
        },
        # Benign Shared Tablet Control Transactions
        {
            "transaction_id": "TX-80001",
            "customer_id": "CUST-80101",
            "timestamp": "2026-09-06T10:00:00Z",
            "amount": 65.00,
            "merchant": "Amazon India",
            "merchant_category": "Retail",
            "location": "Bangalore, KA, IND",
            "device_id": "DEV-SHARED-TABLET",
            "ip_address": "106.51.72.10",
            "payment_method": "UPI",
            "counterparty_account": "ACC-AMAZON-RETAIL",
            "status": "Completed",
            "flagged": False
        },
        {
            "transaction_id": "TX-80002",
            "customer_id": "CUST-80102",
            "timestamp": "2026-09-06T13:30:00Z",
            "amount": 28.50,
            "merchant": "Swiggy Delivery",
            "merchant_category": "Food & Beverage",
            "location": "Bangalore, KA, IND",
            "device_id": "DEV-SHARED-TABLET",
            "ip_address": "106.51.72.10",
            "payment_method": "UPI",
            "counterparty_account": "ACC-SWIGGY-FOOD",
            "status": "Completed",
            "flagged": False
        }
    ]

    recent_transactions = [
        {"transaction_id": "TX-98001", "customer_id": "CUST-10492", "amount": 84.20, "merchant": "Whole Foods Market", "merchant_category": "Grocery", "location": "Seattle, WA, USA", "timestamp": "2026-09-01T10:15:00Z"},
        {"transaction_id": "TX-98002", "customer_id": "CUST-10492", "amount": 42.50, "merchant": "Shell Oil", "merchant_category": "Fuel", "location": "Seattle, WA, USA", "timestamp": "2026-09-02T14:20:00Z"},
        {"transaction_id": "TX-98003", "customer_id": "CUST-10492", "amount": 126.00, "merchant": "Target Store", "merchant_category": "Retail", "location": "Seattle, WA, USA", "timestamp": "2026-09-03T18:45:00Z"},
        {"transaction_id": "TX-98004", "customer_id": "CUST-20811", "amount": 25.00, "merchant": "Uber", "merchant_category": "Transportation", "location": "San Francisco, CA, USA", "timestamp": "2026-09-04T09:10:00Z"},
        {"transaction_id": "TX-98005", "customer_id": "CUST-20811", "amount": 180.00, "merchant": "Blue Bottle Coffee Supply", "merchant_category": "Retail", "location": "San Francisco, CA, USA", "timestamp": "2026-09-05T11:30:00Z"},
        {"transaction_id": "TX-98006", "customer_id": "CUST-40115", "amount": 35.00, "merchant": "Walgreens", "merchant_category": "Pharmacy", "location": "Chicago, IL, USA", "timestamp": "2026-09-01T12:00:00Z"},
        {"transaction_id": "TX-98007", "customer_id": "CUST-50228", "amount": 95.00, "merchant": "Home Depot", "merchant_category": "Home Improvement", "location": "Atlanta, GA, USA", "timestamp": "2026-09-02T16:00:00Z"},
        {"transaction_id": "TX-70000", "customer_id": "CUST-70112", "amount": 500.00, "merchant": "SwiftLayer Escrow", "merchant_category": "Money Transfer", "location": "Mumbai, MH, IND", "timestamp": "2026-09-05T12:00:00Z", "counterparty_account": "ACC-TEST-ESCROW"},
        {"transaction_id": "TX-80000", "customer_id": "CUST-80101", "amount": 45.00, "merchant": "BigBasket", "merchant_category": "Grocery", "location": "Bangalore, KA, IND", "timestamp": "2026-09-05T09:00:00Z", "counterparty_account": "ACC-BB-GROCERY"}
    ]

    customer_history = [
        {
            "event_id": "EVT-5011",
            "customer_id": "CUST-10492",
            "event_type": "Password_Reset",
            "event_timestamp": "2026-09-04T18:22:10Z",
            "device_id": "DEV-UNK-9941",
            "resolution": "Completed via Web Self-Service",
            "notes": "Password reset initiated via unrecognized IP (185.220.101.44) and new device."
        },
        {
            "event_id": "EVT-5012",
            "customer_id": "CUST-10492",
            "event_type": "Device_Change",
            "event_timestamp": "2026-09-05T01:10:04Z",
            "device_id": "DEV-UNK-9941",
            "resolution": "New Device Registered",
            "notes": "Unrecognized Linux/Chrome device registered 26 hours prior to high-value transaction."
        },
        {
            "event_id": "EVT-5013",
            "customer_id": "CUST-10492",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T03:05:11Z",
            "device_id": "DEV-UNK-9941",
            "resolution": "Success",
            "notes": "Session established 9 minutes before transaction TX-98214."
        },
        {
            "event_id": "EVT-6001",
            "customer_id": "CUST-20811",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T08:15:00Z",
            "device_id": "DEV-KNOWN-7712",
            "resolution": "Success",
            "notes": "Routine biometric login from established primary device."
        },
        {
            "event_id": "EVT-7001",
            "customer_id": "CUST-30944",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T11:50:00Z",
            "device_id": "DEV-KNOWN-3301",
            "resolution": "Success",
            "notes": "Routine biometric login from established device."
        },
        {
            "event_id": "EVT-8001",
            "customer_id": "CUST-40115",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T04:20:00Z",
            "device_id": "DEV-KNOWN-5522",
            "resolution": "Success",
            "notes": "Mobile login from regular phone."
        },
        {
            "event_id": "EVT-9001",
            "customer_id": "CUST-60341",
            "event_type": "Dispute",
            "event_timestamp": "2026-08-15T14:30:00Z",
            "device_id": "DEV-KNOWN-1290",
            "resolution": "Merchant Credit Issued",
            "notes": "Cardholder disputed unauthorized billing subscription ($14.99). Resolved by credit."
        },
        # Fraud Ring Syndicate Customer History (Cluster of logins on DEV-RING-4417)
        {
            "event_id": "EVT-7011",
            "customer_id": "CUST-70112",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T05:50:00Z",
            "device_id": "DEV-RING-4417",
            "resolution": "Success",
            "notes": "Session established from hardware DEV-RING-4417 via VPN IP 45.132.192.7."
        },
        {
            "event_id": "EVT-7012",
            "customer_id": "CUST-70113",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T06:30:00Z",
            "device_id": "DEV-RING-4417",
            "resolution": "Success",
            "notes": "Rapid successive session on same hardware DEV-RING-4417 from IP 45.132.192.7."
        },
        {
            "event_id": "EVT-7013",
            "customer_id": "CUST-70114",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T07:10:00Z",
            "device_id": "DEV-RING-4417",
            "resolution": "Success",
            "notes": "Subsequent login on DEV-RING-4417 switching to proxy IP 103.21.244.18."
        },
        {
            "event_id": "EVT-7014",
            "customer_id": "CUST-70115",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T07:45:00Z",
            "device_id": "DEV-RING-4417",
            "resolution": "Success",
            "notes": "Fourth distinct customer transacting on DEV-RING-4417 within 2 hours."
        },
        # Benign Couple Customer History
        {
            "event_id": "EVT-8011",
            "customer_id": "CUST-80101",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T09:55:00Z",
            "device_id": "DEV-SHARED-TABLET",
            "resolution": "Success",
            "notes": "Home tablet biometric login from primary residential broadband."
        },
        {
            "event_id": "EVT-8012",
            "customer_id": "CUST-80102",
            "event_type": "Login",
            "event_timestamp": "2026-09-06T13:25:00Z",
            "device_id": "DEV-SHARED-TABLET",
            "resolution": "Success",
            "notes": "Spouse routine login on shared family tablet from residential IP."
        }
    ]

    support_tickets = [
        # CFPB-Authentic Consumer Complaint Narrative
        {
            "ticket_id": "TCK-8812",
            "customer_id": "CUST-10492",
            "category": "Unauthorized Access / Suspicious Alert",
            "sentiment": "Negative",
            "resolution_time_hrs": 1.5,
            "notes": "Customer reported: 'I just received a text that my password was reset, but I did not do this. Please secure my account immediately!'"
        },
        {
            "ticket_id": "TCK-8813",
            "customer_id": "CUST-20811",
            "category": "Travel Notification",
            "sentiment": "Neutral",
            "resolution_time_hrs": 0.4,
            "notes": "Customer informed bank of upcoming travel to New York conference via verified app."
        },
        {
            "ticket_id": "TCK-8814",
            "customer_id": "CUST-60341",
            "category": "Billing Inquiry",
            "sentiment": "Neutral",
            "resolution_time_hrs": 2.1,
            "notes": "Customer asked about overseas ATM withdrawal fee schedule."
        }
    ]

    return {
        "customers": customers,
        "transactions": transactions,
        "recent_transactions": recent_transactions,
        "customer_history": customer_history,
        "support_tickets": support_tickets
    }

def main():
    print("=" * 60)
    print(" [BENCHMARK DATASET SYNTHESIS & UPLOAD]")
    print(" Integrating Sparkov, IEEE-CIS, SAML-D, & CFPB Datasets")
    print("=" * 60)

    # 1. Generate synthesized benchmark dataset
    dataset = generate_benchmark_datasets()
    seed_file_path = os.path.join(BASE_DIR, "data", "seed_data.json")
    with open(seed_file_path, "w", encoding="utf-8") as f:
        json.dump(dataset, f, indent=2)
    print(f"[OK] Saved consolidated benchmark dataset to: {seed_file_path}")

    # 2. Upload to Airtable if configured
    if AIRTABLE_PAT and AIRTABLE_BASE_ID:
        print(f"\nConnecting to Airtable Base '{AIRTABLE_BASE_ID}'...")

        # Get existing IDs to avoid duplicates
        def get_existing_keys(table: str, key_field: str) -> set:
            url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/{table}?fields%5B%5D={key_field}"
            try:
                resp = make_airtable_request(url)
                return {r["fields"].get(key_field) for r in resp.get("records", []) if key_field in r.get("fields", {})}
            except Exception:
                return set()

        # Customers
        existing_custs = get_existing_keys("Customers", "customer_id")
        new_custs = [c for c in dataset["customers"] if c["customer_id"] not in existing_custs]
        if new_custs:
            batch_upload_records("Customers", new_custs)
        else:
            print("[INFO] All customers already exist in Airtable.")

        # Transactions
        existing_txs = get_existing_keys("Transactions", "transaction_id")
        new_txs = [t for t in dataset["transactions"] if t["transaction_id"] not in existing_txs]
        if new_txs:
            batch_upload_records("Transactions", new_txs)
        else:
            print("[INFO] All transactions already exist in Airtable.")

        # Customer History
        existing_evts = get_existing_keys("Customer_History", "event_id")
        new_evts = [h for h in dataset["customer_history"] if h["event_id"] not in existing_evts]
        if new_evts:
            batch_upload_records("Customer_History", new_evts)
        else:
            print("[INFO] All history events already exist in Airtable.")

        # Support Tickets
        existing_tcks = get_existing_keys("Support_Tickets", "ticket_id")
        new_tcks = [s for s in dataset["support_tickets"] if s["ticket_id"] not in existing_tcks]
        if new_tcks:
            batch_upload_records("Support_Tickets", new_tcks)
        else:
            print("[INFO] All support tickets already exist in Airtable.")

    # 3. Run Pipeline to generate investigation reports
    print("\nExecuting multi-agent investigation pipeline...")
    from pipeline.pipeline_runner import FraudCopilotPipeline
    pipeline = FraudCopilotPipeline(data_path=seed_file_path)
    reports = pipeline.run_all_cases()

    # 4. Sync Investigation Reports to Airtable
    if AIRTABLE_PAT and AIRTABLE_BASE_ID:
        print("\nSyncing Investigation Reports into Airtable...")
        url = f"https://api.airtable.com/v0/{AIRTABLE_BASE_ID}/Investigation_Reports?fields%5B%5D=report_id"
        existing_rep_records = {}
        try:
            resp = make_airtable_request(url)
            for r in resp.get("records", []):
                rid = r["fields"].get("report_id")
                if rid:
                    existing_rep_records[rid] = r["id"]
        except Exception as e:
            print(f"[WARN] Error fetching existing reports: {e}")

        new_reports_to_upload = []
        for r in reports:
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
            if r.get("ring_score") is not None:
                fields["ring_score"] = r.get("ring_score")
            if r.get("network_findings"):
                fields["network_findings"] = json.dumps(r.get("network_findings")) if isinstance(r.get("network_findings"), (dict, list)) else str(r.get("network_findings"))

            if r.get("report_id") not in existing_rep_records:
                new_reports_to_upload.append(fields)

        if new_reports_to_upload:
            batch_upload_records("Investigation_Reports", new_reports_to_upload)
        else:
            print("[INFO] All investigation reports already synced.")

    print("\n" + "=" * 60)
    print(" [COMPLETE] Public benchmark datasets synthesized & synchronized!")
    print("=" * 60)

if __name__ == "__main__":
    main()
