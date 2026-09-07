# Make.com Scenario Setup Guide

This guide describes how to configure and execute the **Multi-Agent Fraud Investigation Copilot** on Make.com.

---

## 1. Architecture Overview in Make.com

Following **"The Agentic AI Handbook"** (Ch.3.3 Multi-Agent Orchestration & Ch.9 5-Layer Defense-in-Depth):

```
                                  +--> [Airtable Search] -> [Agent 1: Transaction-Pattern (Claude)] -> [Parse JSON] --+
                                  |                                                                                    |
[Airtable Trigger: Flagged TX] -> [Router]                                                                             +-> [Agent 3: Fusion (Claude)] -> [Deterministic Assembly] -> [Airtable Create Report]
                                  |                                                                                    |
                                  +--> [Airtable Search] -> [Agent 2: Customer-History (Claude)] ----> [Parse JSON] --+
```

### Why Parallel Branches? (Handbook Ch.3.3)
The two specialist domains — transaction pattern analysis and customer/behavioral history — genuinely require different context and can run in parallel. This is the handbook's explicit justification test for going multi-agent instead of an open-ended single ReAct loop.

---

## 2. One-Click Blueprint Import

1. Log into your [Make.com](https://make.com) account.
2. In the left navigation, click **Scenarios** -> **Create a new scenario**.
3. In the canvas toolbar at the bottom, click the **More options (...)** button -> **Import Blueprint**.
4. Select the [`make_blueprint.json`](./make_blueprint.json) file located in this directory.
5. All 13 modules, router paths, system prompts, and mapping parameters will be automatically pre-populated on your canvas.

---

## 3. Configuring Connections

### Airtable Connection
1. Click on Module 1 (`Trigger: Flagged Transactions`).
2. Add your Airtable Connection using your **Personal Access Token** (PAT).
3. Select your Base (`Fin-Shield`) and the `Transactions` table.
4. Update the remaining Airtable modules (Search Records and Create Record) to use this connection.

### AI Model Connection (Claude 3.5 Sonnet or OpenAI GPT-4o)
1. In Module 4 (`Agent 1`), Module 8 (`Agent 2`), and Module 10 (`Agent 3`):
2. Select your Anthropic or OpenAI connection.
3. The prompt, system instructions, and temperature (0.0 for strict deterministic behavior) are already pre-loaded verbatim from the project specification.

---

## 4. Deterministic Report Assembly (Action-Level Guardrail)
Module 12 (`Deterministic Report Assembly`) is pure JSON templating code, **NOT an LLM call**.
This guarantees:
- Zero hallucination risk in the audit report.
- Traceable data mapping from Agent 1 and Agent 2 outputs into the final audit record.
- Strict compliance with Chapter 9.2 of The Agentic AI Handbook.

---

## 5. Chapter 8.1 Error Direct Handling
Right-click on any AI / JSON Parse module and select **Add error handler** -> **Commit / Set Variable**.
If an LLM produces a malformed JSON payload:
- Write the report with `pipeline_status = "Agent Error - Manual Review Required"`.
- Do NOT retry indefinitely or guess fallback scores.
