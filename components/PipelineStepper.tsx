"use client";

import React, { useState } from "react";
import { CheckCircle2, Clock, Cpu, ArrowRight, ShieldCheck, Database, FileCode, ChevronDown, ChevronUp } from "lucide-react";
import { soundManager } from "@/lib/sound";

import { InvestigationReport } from "@/lib/types";

interface PipelineStepperProps {
  report?: InvestigationReport;
  status?: string;
  reportId?: string;
  confidenceScore?: number;
  verdict?: string;
}

export default function PipelineStepper({
  report,
  status: propStatus,
  reportId: propReportId,
  confidenceScore: propConfidence,
  verdict: propVerdict,
}: PipelineStepperProps) {
  const status = report ? report.pipeline_status : (propStatus || "Pending Analyst Review");
  const reportId = report ? report.report_id : (propReportId || "REP-LIVE");
  const confidenceScore = report ? report.confidence_score : (propConfidence ?? 50);
  const verdict = report ? report.verdict : (propVerdict || "Needs Review");
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      title: "Webhook Ingestion",
      agent: "Make.com HTTP Router",
      latency: "14ms",
      engine: "Deterministic Webhook Parser",
      status: "completed",
      detail: {
        payload_hash: "sha256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069",
        schema_version: "2026.01-strict",
        source: "Stripe Webhook Event / Core Banking Ledger",
      },
    },
    {
      id: 2,
      title: "Transaction-Pattern",
      agent: "Agent 1 (A1)",
      latency: "148ms",
      engine: "Rule Engine + Claude 3.5 Sonnet",
      status: "completed",
      detail: {
        rules_scanned: ["RULE_VELOCITY_RAPID", "RULE_GEO_ANOMALY", "RULE_ROUND_AMOUNT"],
        features_extracted: 18,
        isolated_risk_detected: confidenceScore >= 50,
      },
    },
    {
      id: 3,
      title: "Customer-History",
      agent: "Agent 2 (A2)",
      latency: "92ms",
      engine: "Vector Search + Airtable KB",
      status: "completed",
      detail: {
        records_mined: "support_tickets (2y history) & account_logs",
        signal: "Credential update churn & device switch",
        confidence: "Corroborated ground truth",
      },
    },
    {
      id: 4,
      title: "Fusion Layer (A3)",
      agent: "Risk-Scoring Agent",
      latency: "62ms",
      engine: "Multi-Agent Synthesis (Ch.3.3)",
      status: "completed",
      detail: {
        formula: "0.55 * A1 + 0.45 * A2 + Corroboration(15) - Isolation(10)",
        computed_score: `${confidenceScore}%`,
        deterministic_verdict: verdict,
      },
    },
    {
      id: 5,
      title: "Human Checkpoint",
      agent: "Oversight Layer 3",
      latency: status === "Closed" ? "Signed" : "Awaiting",
      engine: "HMAC Authenticated Analyst",
      status: status === "Closed" ? "completed" : "active",
      detail: {
        policy: "The Agentic AI Handbook Ch.8 & 9 (Human-in-the-Loop Mandate)",
        current_state: status,
      },
    },
  ];

  const handleStepClick = (index: number) => {
    soundManager.playClick();
    setExpandedStep(expandedStep === index ? null : index);
  };

  return (
    <div className="p-4 rounded-xl bg-[#090d15] border border-[#1b253b] space-y-3.5 shadow-terminal-sm">
      <div className="flex items-center justify-between border-b border-[#172236] pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[#10192e] border border-[#1e2f57] text-blue-300 flex items-center justify-center font-mono text-xs">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Multi-Agent Execution Pipeline
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Click any stage to inspect execution latency and payload telemetry
            </p>
          </div>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101726] text-emerald-400 border border-[#1e2e4a]">
          5/5 Stages Grounded
        </span>
      </div>

      {/* Stepper Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {steps.map((step, idx) => {
          const isExpanded = expandedStep === idx;
          const isCompleted = step.status === "completed";
          const isActive = step.status === "active";

          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(idx)}
              className={`p-2.5 rounded-lg border text-left transition flex flex-col justify-between gap-1.5 active:scale-[0.98] ${
                isExpanded
                  ? "bg-[#141d30] border-blue-500 shadow-terminal-sm"
                  : isActive
                  ? "bg-[#111928] border-amber-600/70"
                  : "bg-[#0c101a] border-[#182338] hover:border-[#253554]"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-slate-500">0{step.id}</span>
                {isCompleted ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                )}
              </div>

              <div>
                <div className="text-xs font-mono font-semibold text-slate-200 truncate">
                  {step.title}
                </div>
                <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between mt-0.5">
                  <span className="truncate">{step.agent}</span>
                  <span className="text-blue-300 font-bold tabular-nums ml-1">{step.latency}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Expanded Stage Telemetry Drawer */}
      {expandedStep !== null && (
        <div className="p-3 rounded-lg bg-[#06080e] border border-[#1d2b44] space-y-2 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-[#152033] pb-1.5 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-300">Stage 0{steps[expandedStep].id}:</span>
              <span className="text-white font-semibold">{steps[expandedStep].title}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#10192e] text-slate-400 border border-[#1e2e4a]">
                {steps[expandedStep].engine}
              </span>
            </div>
            <button
              onClick={() => setExpandedStep(null)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              &times; Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
            {Object.entries(steps[expandedStep].detail).map(([k, v]) => (
              <div key={k} className="p-1.5 rounded bg-[#090d15] border border-[#172238] flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase">{k.replace("_", " ")}</span>
                <span className="text-slate-200 truncate mt-0.5">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
