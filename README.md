# Multi-Agent Fraud Investigation Copilot

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

### 4. Three Specialist Agents & False-Positive Reduction (Ch.3.3)
Legacy rule-based systems suffer from 80%+ false-positive rates because a single anomalous metric triggers an alert. Our multi-agent fusion architecture solves this:

```
                                  +--> [Agent 1: Transaction-Pattern Agent] --+
                                  |    (Velocity, Geography, Amount, Merchant) |
[Trigger: Flagged Transaction] -> |                                            +--> [Agent 3: Risk-Scoring Fusion Agent] -> [Deterministic Guardrail] -> [Analyst Dashboard]
                                  |                                            |    (Corroboration Bonus / Isolated Discount)
                                  +--> [Agent 2: Customer-History Agent] -----+
                                       (Account Maturity, Churn, Support Tickets)
```

- **Agent 1 (Transaction-Pattern Specialist):** Analyzes target transaction against customer history for velocity, impossible travel, structuring, and high-risk merchant categories.
- **Agent 2 (Customer-History Specialist):** Examines account maturity, credential churn (password resets / device additions within 24–72 hours), prior dispute flags, and unauthorized access support complaints.
- **Agent 3 (Risk-Scoring Fusion Layer):**
  - **Corroboration Bonus:** When an Agent 1 pattern (e.g., $3,850 transaction in Moscow) aligns temporally with an Agent 2 history signal (unrecognized password reset and device change 26h prior + support ticket complaint), the model applies a corroboration bonus resulting in **Confidence Score ≥ 90% ("Likely Fraud")**.
  - **Isolated-Signal Discount:** When an anomaly is isolated (e.g., travel to New York on an established biometric device with a clean travel notice and zero credential churn), the model applies an isolated-signal discount resulting in **Confidence Score < 40% ("Likely Legitimate")**, slashing false-positive alert fatigue.
  - **Chapter 8.1 Error Classification:** Malformed or invalid agent JSON is classified as a non-retryable escalate failure, producing `pipeline_status = "Agent Error - Manual Review Required"` rather than guessing fallback numbers.

---

### 5. Natural Next Step (Post-Hoc Audit Roadmap)
As a natural post-hackathon roadmap extension (Handbook Ch.9.5), the populated `analyst_decision` ground-truth records will serve as an automated feedback evaluation dataset to continuously assess whether the fusion agent's confidence scores remain statistically well-calibrated against real human analyst outcomes.

---

## Technical Stack & Architecture

- **Make.com:** Visual multi-agent workflow orchestration with parallel router branches and deterministic JSON assembly ([`make_scenario/make_blueprint.json`](./make_scenario/make_blueprint.json)).
- **Airtable:** Relational audit datastore containing 5 tables: `Customers`, `Transactions`, `Customer_History`, `Support_Tickets`, and `Investigation_Reports`.
- **Next.js & Vercel:** Analyst-facing incident review dashboard featuring queue ranking, evidence checklists, raw audit views, and human checkpoint action buttons.
- **Standalone Pipeline Runner:** Python engine ([`pipeline/pipeline_runner.py`](./pipeline/pipeline_runner.py)) capable of running both with live LLMs and offline reference verification.

---

## Quickstart & Verification

### 1. Run the Multi-Agent Pipeline Locally
```bash
# Run all benchmark test cases (ATO fraud, false-positive discount, structuring, Ch.8 error handling)
python pipeline/pipeline_runner.py --test
```

### 2. Launch the Analyst Web Dashboard
```bash
# Start Next.js dashboard
npm run build
npm start
# Open http://localhost:3000
```

### 3. Deploy to Vercel
```bash
# Set your Airtable environment variables in Vercel or locally in .env:
# AIRTABLE_API_KEY=patXXXXXXXXXXXX
# AIRTABLE_BASE_ID=appXXXXXXXXXXXX

vercel --prod
```

### 4. Import Make.com Blueprint
Follow the step-by-step instructions in [`make_scenario/MAKE_SETUP_GUIDE.md`](./make_scenario/MAKE_SETUP_GUIDE.md) to import [`make_scenario/make_blueprint.json`](./make_scenario/make_blueprint.json) into your Make.com account.
