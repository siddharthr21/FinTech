import fs from "fs";
import path from "path";
import { InvestigationReport } from "./types";

const AIRTABLE_PAT = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const LOCAL_STORAGE_PATH = path.join(process.cwd(), "data", "investigation_reports.json");

/**
 * Reads all investigation reports from Airtable REST API (or fallback JSON storage)
 */
export async function getInvestigationReports(): Promise<InvestigationReport[]> {
  // If Airtable credentials are provided, fetch from Airtable REST API
  if (AIRTABLE_PAT && AIRTABLE_BASE_ID) {
    try {
      const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Investigation_Reports?sort%5B0%5D%5Bfield%5D=confidence_score&sort%5B0%5D%5Bdirection%5D=desc`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const json = await res.json();
        const reports: InvestigationReport[] = json.records.map((r: any) => {
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

        if (reports.length > 0) {
          return reports;
        }
      } else {
        console.error("Airtable fetch failed, falling back to local seed reports:", res.status, res.statusText);
      }
    } catch (err) {
      console.error("Airtable API connection error, using local storage:", err);
    }
  }

  // Fallback to local storage
  if (fs.existsSync(LOCAL_STORAGE_PATH)) {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
    const reports: InvestigationReport[] = JSON.parse(raw);
    return reports.sort((a, b) => b.confidence_score - a.confidence_score);
  }

  return [];
}

/**
 * Updates an investigation report with human analyst decision
 * Human Checkpoint (The Agentic AI Handbook, Ch.9.3)
 */
export async function updateAnalystDecision(
  reportId: string,
  decision: "Approved-Fraud" | "False-Positive" | "Escalated",
  notes: string = ""
): Promise<boolean> {
  // If Airtable is active, patch Airtable record
  if (AIRTABLE_PAT && AIRTABLE_BASE_ID) {
    try {
      // Find Airtable record ID if reportId is custom format
      const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Investigation_Reports?filterByFormula={report_id}='${reportId}'`;
      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${AIRTABLE_PAT}` },
      });

      if (searchRes.ok) {
        const searchJson = await searchRes.json();
        const recordId = searchJson.records?.[0]?.id || reportId;

        const patchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Investigation_Reports/${recordId}`;
        const patchRes = await fetch(patchUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${AIRTABLE_PAT}`,
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

        if (patchRes.ok) {
          return true;
        }
      }
    } catch (err) {
      console.error("Failed to patch Airtable, updating local storage:", err);
    }
  }

  // Update in local file storage
  if (fs.existsSync(LOCAL_STORAGE_PATH)) {
    const raw = fs.readFileSync(LOCAL_STORAGE_PATH, "utf-8");
    const reports: InvestigationReport[] = JSON.parse(raw);
    const target = reports.find((r) => r.report_id === reportId || r.id === reportId);
    if (target) {
      target.analyst_decision = decision;
      target.analyst_notes = notes;
      target.pipeline_status = "Closed";
      fs.writeFileSync(LOCAL_STORAGE_PATH, JSON.stringify(reports, null, 2), "utf-8");
      return true;
    }
  }

  return false;
}
