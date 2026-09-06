export interface FindingEvidence {
  source_field?: string;
  source_table?: string;
  source_record_id?: string;
  observed_value?: string;
  baseline_value?: string;
}

export interface PatternFinding {
  anomaly_type: "velocity" | "geography" | "amount" | "merchant";
  severity: number;
  explanation: string;
  evidence: FindingEvidence;
}

export interface HistoryFinding {
  signal_type: "account_maturity" | "credential_churn" | "prior_flags" | "complaint_signal";
  severity: number;
  explanation: string;
  evidence: FindingEvidence;
}

export interface EvidenceTrailItem {
  claim: string;
  source_agent: "transaction_pattern" | "customer_history" | "system_guardrail";
  source_field: string;
  weight: "high" | "medium" | "low";
}

export interface InvestigationReport {
  id?: string; // Airtable internal record ID if present
  report_id: string;
  transaction_id: string;
  summary: string;
  confidence_score: number;
  verdict: "Likely Fraud" | "Needs Review" | "Likely Legitimate";
  detected_patterns: PatternFinding[];
  customer_context: HistoryFinding[];
  fused_reasoning: string;
  evidence_trail: EvidenceTrailItem[];
  recommended_action: "Approve as Fraud" | "Mark False Positive" | "Escalate for Manual Review";
  pipeline_status: "Pending Analyst Review" | "Agent Error - Manual Review Required" | "Closed";
  agent1_output_json: string;
  agent2_output_json: string;
  agent3_output_json: string;
  analyst_decision: "Approved-Fraud" | "False-Positive" | "Escalated" | null;
  analyst_notes: string | null;
  created_at: string;
}
