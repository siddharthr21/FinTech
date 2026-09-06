# Multi-Agent Fraud Investigation Copilot

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?style=flat&logo=next.js)](https://nextjs.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat&logo=tailwind-css)](https://tailwindcss.com/)
[![Make.com](https://img.shields.io/badge/Make.com-Orchestrator-purple?style=flat&logo=make)](https://make.com/)
[![Airtable](https://img.shields.io/badge/Airtable-Audit_Datastore-fcb400?style=flat&logo=airtable)](https://airtable.com/)
[![Autonomy](https://img.shields.io/badge/Autonomy-L2_Human--Gated-emerald?style=flat)](https://github.com/siddharthr21/FinTech)
[![Oversight](https://img.shields.io/badge/Oversight-5--Layer_Defense-blue?style=flat)](https://github.com/siddharthr21/FinTech)

> **Built with "The Agentic AI Handbook" Design Discipline (Comed Kares Innovation Hub / ERA Foundation, 2026)**  
> *Autonomy Level: L2 (Tool-Using Agent, Human-Gated) | Pattern: Multi-Agent Orchestration (Ch.3.3) | Oversight: 5-Layer Defense-in-Depth (Ch.9)*

---

## 3-Minute Judge Presentation Guide

### 1. The Four Fit Questions (Handbook Ch.7)
Is an agentic system truly justified for fraud investigation, or is this "agentic-AI-for-its-own-sake"? We answer the Handbook's four fit tests:

1. **Does it require multiple steps and disparate tools?**  
   **Yes.** Investigating financial crime requires simultaneous analysis across unrelated domains: real-time transaction velocities, geographic impossibility checks, account maturity baselines, historical credential churn, and support ticket complaints.
2. **Is the path to the goal variable and unplannable in advance?**  
   **Yes.** No two fraud cases match the same static flowchart. One case hinges on an IP subnet jump corroborated with an SMS password reset; another hinges on structuring just below reporting thresholds. The agents must dynamically surface and correlate variable signals per case.
3. **Can success be objectively checked?**  
   **Yes.** Every single claim emitted by the system is strictly grounded to a specific field and source table in an auditable evidence trail. A certified human fraud analyst reviews the evidence and verifies the verdict before execution.
4. **Is the cost of a wrong action tolerable and reversible?**  
   **Yes.** The system sits in an advisory capacity. It **never** auto-closes accounts or freezes funds autonomously. Because all consequential actions require human sign-off, the risk of uncontained autonomous harm is eliminated.

---

### 2. Autonomy Level L2: Deliberate Scoping (Handbook Ch.1)
This copilot deliberately operates at **Autonomy Level L2 ("Tool-Using Agent, Human-Gated")** on the Handbook's L0–L4 spectrum:
- **Autonomous Perception & Synthesis:** Specialist agents independently parse raw data and identify anomalies without manual hand-holding.
- **Strictly Human-Gated Action:** Every consequential outcome (the final fraud verdict and account disposition) **requires explicit human analyst sign-off**. The stopping condition (Ch.4.4) is deterministic: a case remains active until an analyst clicks **Approve as Fraud**, **Mark False Positive**, or **Escalate for Manual Review**.

---

### 3. Five-Layer Defense-in-Depth Oversight Model (Handbook Ch.9)
Rather than relying on a superficial "human in the loop" checkbox, the system implements all 5 layers of the handbook's oversight architecture:

```
[Layer 1: Scoped Permissions]      -> Agents only possess read access; zero direct write access to Airtable
[Layer 2: Action-Level Guardrail]  -> Report Generator is DETERMINISTIC CODE, not an LLM call (zero hallucination)
[Layer 3: Human Checkpoint]        -> Analyst Dashboard enforces mandatory Approve/False-Positive/Escalate gate
[Layer 4: Runtime Monitoring]      -> Full inputs, outputs, timestamps, and schemas logged in Investigation_Reports
[Layer 5: Post-Hoc Audit Trail]    -> Analyst decisions recorded to build future calibration feedback datasets
```

1. **Scoped Permissions (Ch.9.1):** Agents can only read specific tables (`Customers`, `Transactions`, `Customer_History`, `Support_Tickets`). No LLM has direct write permission.
2. **Action-Level Guardrails (Ch.9.2):** The Investigation Report is assembled by **deterministic Python/JSON code**, not a 4th LLM call. This guarantees zero hallucination in compliance-facing audit documents.
3. **Human Checkpoints (Ch.9.3):** The analyst dashboard cannot close a case without an explicit human PATCH action (`Approve-Fraud`, `False-Positive`, or `Escalated`).
4. **Runtime Monitoring (Ch.9.4):** Every agent input, raw JSON output, and timestamp is permanently recorded in Airtable's `Investigation_Reports` table.
5. **Post-Hoc Audit (Ch.9.5):** The `analyst_decision` and `analyst_notes` fields create a permanent feedback loop to evaluate agent calibration over time.

---

### 4. The Three Agent Prompts & Corroboration Mechanics (Ch.3.3)
Legacy rule-based systems suffer from 80%+ false-positive rates because a single anomalous metric triggers an alert. Our multi-agent fusion architecture solves this:

```
                                  +--> [Agent 1: Transaction-Pattern Agent] --+
                                  |    (Velocity, Geography, Amount, Merchant) |
[Trigger: Flagged Transaction] -> |                                            +--> [Agent 3: Risk-Scoring Fusion Agent] -> [Deterministic Guardrail] -> [Analyst Dashboard]
                                  |                                            |    (Corroboration Bonus / Isolated Discount)
                                  +--> [Agent 2: Customer-History Agent] -----+
                                       (Account Maturity, Churn, Support Tickets)
```

#### How Corroboration & False-Positive Reduction Works:
- **Corroboration Bonus:** When an Agent 1 pattern (e.g., $3,850 transaction in Moscow) aligns temporally with an Agent 2 history signal (unrecognized password reset and device change 26h prior + support ticket complaint), the model applies a corroboration bonus resulting in **Confidence Score ≥ 90% ("Likely Fraud")**.
- **Isolated-Signal Discount:** When an anomaly is isolated (e.g., travel to New York on an established biometric device with a clean travel notice and zero credential churn), the model applies an isolated-signal discount resulting in **Confidence Score < 40% ("Likely Legitimate")**, slashing false-positive alert fatigue.
- **Chapter 8.1 Error Classification:** Malformed or invalid agent JSON is classified as a non-retryable escalate failure, producing `pipeline_status = "Agent Error - Manual Review Required"` rather than guessing fallback numbers.

#### Verbatim Agent Prompts & Schemas:

<details>
<summary><b>View Agent 1 System Prompt (Transaction-Pattern Agent)</b></summary>

```
You are the Transaction-Pattern Agent inside a multi-agent fraud
investigation system. Analyze the target transaction against the
customer's recent transaction history and flag statistical/behavioral
anomalies only. Do not make a final fraud decision. Do not iterate or ask
follow-up questions — produce one final structured judgment from the data
given.

Analyze only: VELOCITY, GEOGRAPHY (impossible travel), AMOUNT (deviation
from historical mean/std, or structuring just under approval thresholds),
MERCHANT (unseen category or high-fraud-rate category). Only report a
finding if evidence supports it — never invent anomalies. An empty
findings array is a valid and correct output when nothing is anomalous.

Respond ONLY with valid JSON, no prose, no markdown:
{
  "agent": "transaction_pattern",
  "transaction_id": "<id>",
  "findings": [
    {
      "anomaly_type": "velocity|geography|amount|merchant",
      "severity": 0-100,
      "explanation": "one sentence",
      "evidence": {
        "source_field": "<field>",
        "observed_value": "<value>",
        "baseline_value": "<value>"
      }
    }
  ],
  "overall_pattern_risk": 0-100
}
```
</details>

<details>
<summary><b>View Agent 2 System Prompt (Customer-History Agent)</b></summary>

```
You are the Customer-History Agent inside a multi-agent fraud investigation
system. Contextualize the target transaction using customer profile,
behavioral baseline, and prior history. Do not make a final fraud decision.
Do not iterate or ask follow-up questions — produce one final structured
judgment from the data given.

Analyze only: ACCOUNT MATURITY (new account + high value transaction),
CREDENTIAL CHURN (password reset/device change 24-72h before the
transaction), PRIOR FLAGS (past fraud flags/disputes and their resolution),
COMPLAINT SIGNAL (recent unauthorized-access support tickets). Only report
a finding if evidence supports it. An empty findings array is a valid and
correct output when nothing is anomalous.

Respond ONLY with valid JSON, no prose, no markdown:
{
  "agent": "customer_history",
  "customer_id": "<id>",
  "findings": [
    {
      "signal_type": "account_maturity|credential_churn|prior_flags|complaint_signal",
      "severity": 0-100,
      "explanation": "one sentence",
      "evidence": {
        "source_table": "Customers|Customer_History|Support_Tickets",
        "source_record_id": "<id>",
        "observed_value": "<value>"
      }
    }
  ],
  "overall_context_risk": 0-100
}
```
</details>

<details>
<summary><b>View Agent 3 System Prompt (Risk-Scoring Fusion Agent)</b></summary>

```
You are the Risk-Scoring Agent, the fusion layer of a multi-agent fraud
investigation system. You receive the Transaction-Pattern Agent's and
Customer-History Agent's JSON outputs — you do not have access to raw
transaction or customer data directly. Cross-reference the two inputs:
apply a corroboration bonus when findings temporally align across agents
(this is the strongest fraud signature, e.g., a device change shortly
before a geographically anomalous transaction); apply an isolated-signal
discount when a finding has no corroboration, since a single isolated
moderate finding should not produce a high-confidence verdict — this is
how the system keeps false positives down relative to naive
threshold-based legacy systems. Every point of confidence must trace back
to a specific finding in the inputs — never assert an ungrounded risk
factor. You do not take action and you are not the final decision-maker —
a human analyst always makes the final call.

Verdict bands: >=75 "Likely Fraud", 40-74 "Needs Review", <40 "Likely
Legitimate".

Respond ONLY with valid JSON, no prose, no markdown:
{
  "agent": "risk_scoring",
  "transaction_id": "<id>",
  "confidence_score": 0-100,
  "verdict": "Likely Fraud|Needs Review|Likely Legitimate",
  "fused_reasoning": "2-4 sentences, explicitly naming any corroboration",
  "evidence_trail": [
    {
      "claim": "plain language claim",
      "source_agent": "transaction_pattern|customer_history",
      "source_field": "<field>",
      "weight": "high|medium|low"
    }
  ],
  "recommended_analyst_action": "Approve as Fraud|Mark False Positive|Escalate for Manual Review"
}
```
</details>

---

### 5. Analyst Authentication & Post-Hoc Audit Trail (Handbook Ch.9.1 & Ch.9.5)
The platform features an authenticated analyst gateway and immutable decision attribution:
- **Certified Analyst Roster (Layer 1 Scoped Permissions):** Certified investigators (e.g. Sarah Chen [Lead Fraud Investigator, Tier 3], Marcus Vance [Senior AML Compliance Analyst, Tier 2], Elena Rostova [Fraud Operations Specialist, Tier 1]) authenticate via cryptographically signed sessions (`/api/auth`).
- **Human Checkpoint Gating (Layer 3):** The case resolution endpoint (`PATCH /api/reports/[id]`) strictly requires an authenticated analyst session; unauthorized attempts are blocked with `401 Unauthorized`.
- **Closed-Case Attribution (Layer 5 Post-Hoc Audit):** Every finalized case records `closed_by` (analyst name and credential ID) and `closed_at` (ISO 8601 timestamp) in both the Airtable `Investigation_Reports` datastore and local audit logs.
- **Continuous Calibration:** The populated `analyst_decision` and `closed_by` records serve as an automated feedback evaluation dataset to continuously evaluate whether the fusion agent's confidence scores remain well-calibrated against certified human decisions over time.

---

## Technical Stack & Architecture

- **Make.com:** Visual multi-agent workflow orchestration with parallel router branches and deterministic JSON assembly ([`make_scenario/make_blueprint.json`](./make_scenario/make_blueprint.json)).
- **Airtable:** Relational audit datastore containing 5 tables: `Customers`, `Transactions`, `Customer_History`, `Support_Tickets`, and `Investigation_Reports`.
- **Next.js & Vercel:** Analyst-facing incident review dashboard featuring queue ranking, evidence checklists, raw audit views, and human checkpoint action buttons.
- **Deterministic Action Guardrail:** Python module ([`pipeline/deterministic_report_generator.py`](./pipeline/deterministic_report_generator.py)) assembling audit reports without LLM generation.
- **Standalone Pipeline Runner:** Python engine ([`pipeline/pipeline_runner.py`](./pipeline/pipeline_runner.py)) running the agents against any OpenAI-compatible provider (`--live`) or against recorded reference outputs (`--offline`), sharing the same deterministic guardrail as the Make.com scenario.

---

## Benchmark Scenarios in Seed Data

Derived from public financial crime benchmarks (**Sparkov**, **IEEE-CIS**, **SAML-D**, and **CFPB**):

| Case ID | Type | Key Signals | Offline Reference Score | Verdict |
|---|---|---|---|---|
| **TX-98214** | ATO Fraud Chain | Moscow IP + $3,850 electronics + password reset 36h prior + SMS alert ticket | **94%** | **Likely Fraud** (Corroboration Bonus) |
| **TX-98215** | Benign Travel (False Pos) | New York location + regular cardholder device + travel ticket on file | **38%** | **Likely Legitimate** (Isolated-Signal Discount) |
| **TX-98217** | Structuring Anomaly | $990 transfer (just under $1k limit) + new account (<45d) | **68%** | **Needs Review** (Compliance Review) |
| **TX-ERR-9999** | Schema Failure | Injected unparseable LLM output | **0%** | **Agent Error - Manual Review Required** (Ch.8.1) |

The "Offline Reference Score" column is what `python pipeline/pipeline_runner.py --offline`
always reproduces — it replays hardcoded fixture logic keyed on transaction ID, not an LLM
call, so it's deterministic and matches this table exactly every time.

**Live scores will differ, and that's expected.** Run with `--live` and a real model reasons
over the same underlying facts instead of returning a scripted number, so its output varies
by provider, model, and run. `data/investigation_reports.json` in this repo currently holds
one such live run against Groq's `openai/gpt-oss-120b`:

| Case ID | Offline Reference | Live Score (Groq `gpt-oss-120b`) | Verdict (Live) |
|---|---|---|---|
| **TX-98214** | 94% | 85% | Likely Fraud |
| **TX-98215** | 38% | 52% | Needs Review |
| **TX-98217** | 68% | 45% | Needs Review |
| **TX-ERR-9999** | 0% (forced schema failure) | 0% | Agent Error - Manual Review Required |

Both runs agree on the direction of every real case (TX-98214 still reads as fraud, TX-98215
and TX-98217 still land below it) even though the exact numbers move — that agreement, not
digit-for-digit reproduction, is what the live mode is meant to demonstrate. The forced-error
case (`TX-ERR-9999`) stays at 0% either way, since Agent 1's output is injected as malformed
regardless of mode.

---

## Quickstart & Verification

### 1. Run the Multi-Agent Pipeline Locally

The runner has two modes. **Live** mode sends the three verbatim agent prompts to any
OpenAI-compatible provider; **offline** mode replays recorded reference outputs so the
benchmark table above is reproducible with no network access or API key.

```bash
# Offline reference fixtures - no key, no network
python pipeline/pipeline_runner.py --offline

# Live agents - copy .env.example to .env and set LLM_API_KEY first
python pipeline/pipeline_runner.py --live

# Guardrail self-checks (Ch.8.1 error classification + benchmark scores)
python pipeline/test_pipeline.py
```

With no flag, the runner goes live when an LLM provider is configured and falls back to
offline otherwise. Free providers (Groq, Google AI Studio, Cerebras, OpenRouter, local
Ollama) and their `LLM_BASE_URL` / `LLM_MODEL` values are listed in
[`.env.example`](./.env.example); switching provider is two environment variables, not a
code change.

In live mode the Ch.8.1 guardrail stops being a simulation: an unreachable provider, a
truncated reply, or a model that emits prose instead of schema-valid JSON all produce
`pipeline_status = "Agent Error - Manual Review Required"` with a 0% score, and the
fusion agent is never run on a specialist output that failed validation. A `429` rate
limit (easy to hit on a free-tier token budget once 3 agents fire per transaction) is
retried with backoff automatically instead of escalating immediately, since it's a
transient condition, not a schema violation.

### 2. Launch the Analyst Web Dashboard

**Windows, one click:**
```bash
run.bat
```
Starts the dev server in its own window and opens `http://localhost:3000` in your
default browser as soon as it responds.

**Manual, any OS:**
```bash
npm install
npm run dev          # fast, hot-reload - use this while developing
# or, for a production build:
npm run build && npm start
# Open http://localhost:3000
```

Without Airtable credentials configured, the dashboard reads straight from
[`data/investigation_reports.json`](./data/investigation_reports.json) — the same file
`pipeline_runner.py` writes to, so running the pipeline and refreshing the dashboard is
a complete local loop with no external services.

### 3. Deploy to Vercel
```bash
# Set your Airtable environment variables in Vercel or locally in .env:
# AIRTABLE_API_KEY=patXXXXXXXXXXXX
# AIRTABLE_BASE_ID=appXXXXXXXXXXXX

vercel --prod
```

### 4. Import Make.com Blueprint
Follow the step-by-step instructions in [`make_scenario/MAKE_SETUP_GUIDE.md`](./make_scenario/MAKE_SETUP_GUIDE.md) to import [`make_scenario/make_blueprint.json`](./make_scenario/make_blueprint.json) into your Make.com account.
