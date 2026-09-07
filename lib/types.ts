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
  evidence_id?: string;
  claim: string;
  source_agent: "transaction_pattern" | "customer_history" | "system_guardrail" | "ring_detector";
  source_field: string;
  weight: "high" | "medium" | "low";
  entities?: string[];
  category?: "observed_fact" | "derived_signal" | "hypothesis";
}

export interface InvestigationStep {
  step: number;
  agent: string;
  check?: string;
  trigger: string;
  evidence_found: string[];
}

export interface Hypothesis {
  name: string;
  score: number;
}

export interface RingFinding {
  signal_type: "shared_device" | "shared_ip" | "transfer_chain" | "fan_in_out" | "temporal_cluster" | "account_age_cluster";
  severity: number;
  explanation: string;
  entities: string[];
  evidence: Record<string, any>;
}

export interface NetworkGraphNode {
  id: string;
  label: string;
  type: "customer" | "device" | "ip" | "account";
  isFlagged?: boolean;
}

export interface NetworkGraphEdge {
  source: string;
  target: string;
  relationship: string;
}

export interface RingAnalysisResult {
  cluster_id: string;
  target_transaction_id?: string;
  target_customer_id?: string;
  ring_score: number;
  is_suspicious_ring: boolean;
  signals_triggered: string[];
  findings: RingFinding[];
  entities: {
    customers: string[];
    devices: string[];
    ips: string[];
    counterparty_accounts: string[];
  };
  graph?: {
    nodes: NetworkGraphNode[];
    edges: NetworkGraphEdge[];
  };
  summary: string;
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
  ring_score?: number | null;
  network_findings?: RingAnalysisResult | null;
  fused_reasoning: string;
  evidence_trail: EvidenceTrailItem[];
  supporting_evidence?: EvidenceTrailItem[];
  contradicting_evidence?: EvidenceTrailItem[];
  investigation_path?: InvestigationStep[];
  hypotheses?: Hypothesis[];
  completed_checks?: string[];
  recommended_action: "Approve as Fraud" | "Mark False Positive" | "Escalate for Manual Review";
  pipeline_status: "Pending Analyst Review" | "Agent Error - Manual Review Required" | "Closed";
  agent1_output_json: string;
  agent2_output_json: string;
  agent3_output_json: string;
  analyst_decision: "Approved-Fraud" | "False-Positive" | "Escalated" | null;
  analyst_notes: string | null;
  closed_by?: string | null;
  closed_at?: string | null;
  // Provenance: which model, and which version of the prompts/pipeline,
  // produced this verdict. Only populated by the Python pipeline_runner.py
  // path (see pipeline/deterministic_report_generator.py) - a report the
  // Make.com scenario wrote directly will have these as null.
  model_provider?: string | null;
  model_id?: string | null;
  pipeline_version?: string | null;
  prompt_version?: string | null;
  created_at: string;
}

export interface AnalystUser {
  id: string; // e.g. "ANL-802"
  name: string; // e.g. "Sarah Chen"
  email: string;
  role: string; // e.g. "Lead Fraud Investigator"
  tier: string; // e.g. "Tier 3 (Principal Reviewer)"
  initials: string;
  badgeColor: string;
}
