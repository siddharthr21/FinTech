import fs from "fs";
import path from "path";
import { InvestigationReport } from "./types";

const LOCAL_STORAGE_PATH = path.join(process.cwd(), "data", "investigation_reports.json");

export function getAirtableConfig() {
  const pat = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || "";
  let baseId = process.env.AIRTABLE_BASE_ID || "";
  if (baseId === "app9jv5jY2fw9fp6") {
    baseId = "app9jv5jsY2fw9fp6";
  }
  return {
    pat,
    baseId,
    isConfigured: Boolean(pat && baseId),
  };
}

/** Escape a value for interpolation into an Airtable filterByFormula string literal. */
function escapeFormulaValue(value: string): string {
  return value.split("\\").join("\\\\").split("'").join("\\'");
}

/**
 * Reads all investigation reports from Airtable REST API (or fallback JSON storage).
 * When Airtable is configured it is the source of truth: an empty table returns an
 * empty queue rather than silently serving the local seed file as if it were live data.
 */
export async function getInvestigationReports(): Promise<InvestigationReport[]> {
  const config = getAirtableConfig();
  if (config.isConfigured) {
    const url = `https://api.airtable.com/v0/${config.baseId}/Investigation_Reports?sort%5B0%5D%5Bfield%5D=confidence_score&sort%5B0%5D%5Bdirection%5D=desc`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Airtable read failed (${res.status} ${res.statusText}). Refusing to serve stale local seed data as live audit records.`);
    }

    const json = await res.json();
    return (json.records || []).map((r: any) => {
      const fields = r.fields;
      let evidence_trail = [];
      let detected_patterns = [];
      let customer_context = [];

      try {
        evidence_trail = typeof fields.evidence_trail === "string" ? JSON.parse(fields.evidence_trail) : (fields.evidence_trail || []);
      } catch (e) {
        evidence_trail = [];
      }

      try {
        const a1 = JSON.parse(fields.agent1_output_json || "{}");
        detected_patterns = a1.findings || [];
      } catch (e) {}

      try {
        const a2 = JSON.parse(fields.agent2_output_json || "{}");
        customer_context = a2.findings || [];
      } catch (e) {}

      return {
        id: r.id,
        report_id: fields.report_id,
        transaction_id: fields.transaction_id,
        summary: fields.summary || `Investigation Report for TX ${fields.transaction_id}`,
        confidence_score: fields.confidence_score ?? 0,
        verdict: fields.verdict || "Needs Review",
        detected_patterns,
        customer_context,
        fused_reasoning: fields.fused_reasoning || "",
        evidence_trail,
        recommended_action: fields.recommended_action || "Escalate for Manual Review",
        pipeline_status: fields.pipeline_status || "Pending Analyst Review",
        agent1_output_json: fields.agent1_output_json || "{}",
        agent2_output_json: fields.agent2_output_json || "{}",
        agent3_output_json: fields.agent3_output_json || "{}",
        analyst_decision: fields.analyst_decision || null,
        analyst_notes: fields.analyst_notes || null,
        created_at: fields.created_at || new Date().toISOString(),
      };
    });
  }

  // Local demo storage (no Airtable credentials configured)
  if (fs.existsSync(LOCAL_STORAGE_PATH)) {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
    const reports: InvestigationReport[] = JSON.parse(raw);
    return reports.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  return [];
}

/**
 * Updates an investigation report with human analyst decision.
 * Human Checkpoint (The Agentic AI Handbook, Ch.9.3).
 *
 * The audit-trail guarantee only holds if a failed Airtable write surfaces as a
 * failure, so an Airtable error throws instead of quietly writing to local disk
 * and reporting success to the analyst.
 */
export async function updateAnalystDecision(
  reportId: string,
  decision: "Approved-Fraud" | "False-Positive" | "Escalated",
  notes: string = ""
): Promise<boolean> {
  const config = getAirtableConfig();
  if (config.isConfigured) {
    const formula = `{report_id}='${escapeFormulaValue(reportId)}'`;
    const searchUrl = `https://api.airtable.com/v0/${config.baseId}/Investigation_Reports?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`;
    const searchRes = await fetch(searchUrl, {
      headers: { Authorization: `Bearer ${config.pat}` },
      cache: "no-store",
    });

    if (!searchRes.ok) {
      throw new Error(`Airtable lookup failed (${searchRes.status} ${searchRes.statusText}).`);
    }

    const searchJson = await searchRes.json();
    const recordId = searchJson.records?.[0]?.id;
    if (!recordId) {
      return false; // No such report -> route answers 404.
    }

    const patchUrl = `https://api.airtable.com/v0/${config.baseId}/Investigation_Reports/${recordId}`;
    const patchRes = await fetch(patchUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${config.pat}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          analyst_decision: decision,
          analyst_notes: notes,
          pipeline_status: "Closed",
        },
      }),
    });

    if (!patchRes.ok) {
      const detail = await patchRes.text().catch(() => "");
      throw new Error(`Airtable write failed (${patchRes.status} ${patchRes.statusText}). ${detail}`.trim());
    }

    return true;
  }

  // Serverless / Vercel detection: fail fast with actionable guidance instead of EROFS
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    throw new Error(
      "Read-only serverless deployment detected without Airtable configuration. " +
      "Please set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in your Vercel Project Settings (Settings -> Environment Variables) so decisions persist to Airtable."
    );
  }

  // Local demo storage. Serverless filesystems are read-only, so a failed write
  // must surface rather than look like a recorded decision.
  if (!fs.existsSync(LOCAL_STORAGE_PATH)) {
    return false;
  }

  const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
  const reports: InvestigationReport[] = JSON.parse(raw);
  const target = reports.find((r) => r.report_id === reportId || r.id === reportId);
  if (!target) {
    return false;
  }

  target.analyst_decision = decision;
  target.analyst_notes = notes;
  target.pipeline_status = "Closed";

  try {
    fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(reports, null, 2), "utf-8");
  } catch (err: any) {
    throw new Error(
      `Could not persist the analyst decision to local storage (${err?.code || err?.message}). ` +
        `Read-only deployments (Vercel/serverless) must set AIRTABLE_API_KEY and AIRTABLE_BASE_ID so decisions land in the audit datastore.`
    );
  }

  return true;
}
