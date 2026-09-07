"use client";

import React, { useState, useEffect } from "react";
import { Sliders, RotateCcw, Sparkles, ArrowRight, ShieldCheck, ShieldAlert, AlertTriangle } from "lucide-react";
import { soundManager } from "@/lib/sound";

import { InvestigationReport, PatternFinding, HistoryFinding } from "@/lib/types";

interface WhatIfRiskSimulatorProps {
  report?: InvestigationReport;
  originalScore?: number;
  initialA1Severity?: number;
  initialA2Severity?: number;
  transactionId?: string;
  baseScore?: number;
  detectedPatterns?: PatternFinding[];
  customerContext?: HistoryFinding[];
  onApplyToNotes?: (notes: string) => void;
  onApplyHypothesis?: (notes: string) => void;
}

export default function WhatIfRiskSimulator({
  report,
  originalScore: propOrigScore,
  initialA1Severity: propA1,
  initialA2Severity: propA2,
  transactionId: propTxId,
  baseScore: propBaseScore,
  detectedPatterns: propPatterns,
  customerContext: propContext,
  onApplyToNotes,
  onApplyHypothesis,
}: WhatIfRiskSimulatorProps) {
  const originalScore = report?.confidence_score ?? propBaseScore ?? propOrigScore ?? 50;
  const transactionId = report?.transaction_id ?? propTxId ?? "TX-UNKNOWN";

  const calcA1 = React.useCallback(() => {
    if (propA1 !== undefined) return propA1;
    const patterns = report?.detected_patterns ?? propPatterns ?? [];
    if (patterns.length === 0) return 30;
    return Math.max(...patterns.map((p) => p.severity));
  }, [propA1, report?.detected_patterns, propPatterns]);

  const calcA2 = React.useCallback(() => {
    if (propA2 !== undefined) return propA2;
    const context = report?.customer_context ?? propContext ?? [];
    if (context.length === 0) return 25;
    return Math.max(...context.map((c) => c.severity));
  }, [propA2, report?.customer_context, propContext]);

  const initialA1 = calcA1();
  const initialA2 = calcA2();

  const [a1Severity, setA1Severity] = useState<number>(initialA1);
  const [a2Severity, setA2Severity] = useState<number>(initialA2);
  const [hasCorroboration, setHasCorroboration] = useState<boolean>(
    initialA1 >= 50 && initialA2 >= 50
  );
  const [hasIsolationDiscount, setHasIsolationDiscount] = useState<boolean>(
    (initialA1 >= 50 && initialA2 < 40) || (initialA2 >= 50 && initialA1 < 40)
  );

  // Sync when case changes
  useEffect(() => {
    const newA1 = calcA1();
    const newA2 = calcA2();
    setA1Severity(newA1);
    setA2Severity(newA2);
    setHasCorroboration(newA1 >= 50 && newA2 >= 50);
    setHasIsolationDiscount(
      (newA1 >= 50 && newA2 < 40) || (newA2 >= 50 && newA1 < 40)
    );
  }, [calcA1, calcA2, report, propBaseScore, propTxId]);

  // Compute simulated fusion score
  const baseCalculated = Math.round(0.55 * a1Severity + 0.45 * a2Severity);
  const corroborationBonus = hasCorroboration ? 15 : 0;
  const isolationDiscount = hasIsolationDiscount ? -10 : 0;
  const simulatedScore = Math.min(100, Math.max(5, baseCalculated + corroborationBonus + isolationDiscount));
  const delta = simulatedScore - originalScore;

  const handleReset = () => {
    soundManager.playClick();
    const newA1 = calcA1();
    const newA2 = calcA2();
    setA1Severity(newA1);
    setA2Severity(newA2);
    setHasCorroboration(newA1 >= 50 && newA2 >= 50);
    setHasIsolationDiscount(
      (newA1 >= 50 && newA2 < 40) || (newA2 >= 50 && newA1 < 40)
    );
  };

  const handleApply = () => {
    soundManager.playClick();
    const rationale = `[What-If Sandbox Simulation]: Simulated with A1 Severity=${a1Severity}/100, A2 Severity=${a2Severity}/100, Corroboration=${hasCorroboration ? "+15%" : "0%"}, Isolation=${hasIsolationDiscount ? "-10%" : "0%"}. Yields Simulated Fusion Score=${simulatedScore}% (${delta >= 0 ? `+${delta}%` : `${delta}%`} vs ground truth ${originalScore}%).`;
    if (onApplyHypothesis) {
      onApplyHypothesis(rationale);
    } else if (onApplyToNotes) {
      onApplyToNotes(rationale);
    }
  };

  return (
    <div className="p-4 rounded-xl bg-[#090d15] border border-[#1b253b] space-y-4 shadow-terminal-sm">
      <div className="flex items-center justify-between border-b border-[#172236] pb-3">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-[#10192e] border border-[#1e2f57] text-blue-300 flex items-center justify-center">
            <Sliders className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
              Interactive What-If Fusion Simulator
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Adjust specialist agent weights to test fusion sensitivity
            </p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-slate-400 hover:text-white text-[11px] font-mono flex items-center gap-1 px-2 py-1 rounded bg-[#121929] border border-[#1c273e] transition active:scale-[0.95]"
          title="Reset weights to ground truth findings"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Sliders Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Agent 1 Slider */}
        <div className="space-y-1.5 bg-[#0e1422] p-3 rounded-lg border border-[#19243a]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-blue-300 font-semibold">A1: Pattern Severity</span>
            <span className="text-white font-bold tabular-nums px-1.5 py-0.5 rounded bg-[#141c2e] border border-[#202d48]">
              {a1Severity}/100
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={a1Severity}
            onChange={(e) => {
              setA1Severity(Number(e.target.value));
              soundManager.playClick();
            }}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0 (Normal)</span>
            <span>50 (Suspicious)</span>
            <span>100 (Critical)</span>
          </div>
        </div>

        {/* Agent 2 Slider */}
        <div className="space-y-1.5 bg-[#0e1422] p-3 rounded-lg border border-[#19243a]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-purple-300 font-semibold">A2: Customer Severity</span>
            <span className="text-white font-bold tabular-nums px-1.5 py-0.5 rounded bg-[#141c2e] border border-[#202d48]">
              {a2Severity}/100
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={a2Severity}
            onChange={(e) => {
              setA2Severity(Number(e.target.value));
              soundManager.playClick();
            }}
            className="w-full accent-purple-500 cursor-pointer"
          />
          <div className="flex justify-between text-[9px] font-mono text-slate-500">
            <span>0 (Normal)</span>
            <span>50 (Suspicious)</span>
            <span>100 (Critical)</span>
          </div>
        </div>
      </div>

      {/* Rules Corroboration Toggles */}
      <div className="flex flex-wrap items-center gap-3 text-xs font-mono pt-1">
        <label className="flex items-center gap-2 cursor-pointer bg-[#0e1422] px-2.5 py-1.5 rounded-lg border border-[#19243a] text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={hasCorroboration}
            onChange={(e) => {
              setHasCorroboration(e.target.checked);
              soundManager.playClick();
            }}
            className="rounded border-[#253554] text-blue-500 focus:ring-0"
          />
          <span>Corroboration Bonus (+15%)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer bg-[#0e1422] px-2.5 py-1.5 rounded-lg border border-[#19243a] text-slate-300 hover:text-white">
          <input
            type="checkbox"
            checked={hasIsolationDiscount}
            onChange={(e) => {
              setHasIsolationDiscount(e.target.checked);
              soundManager.playClick();
            }}
            className="rounded border-[#253554] text-amber-500 focus:ring-0"
          />
          <span>Isolated Signal Discount (-10%)</span>
        </label>
      </div>

      {/* Simulation Result Comparison Box */}
      <div className="p-3.5 rounded-lg bg-[#0d1320] border border-[#212e48] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400">Simulated Fusion Score:</span>
            <span
              className={`text-lg font-mono font-extrabold tabular-nums ${
                simulatedScore >= 75
                  ? "text-rose-400"
                  : simulatedScore >= 40
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {simulatedScore}%
            </span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                delta > 0
                  ? "bg-rose-950 text-rose-300 border border-rose-800"
                  : delta < 0
                  ? "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              {delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "±0%"} vs Ground Truth ({originalScore}%)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 font-sans">
            Formula: round(0.55 &times; A1 + 0.45 &times; A2 {hasCorroboration ? "+ 15" : ""} {hasIsolationDiscount ? "- 10" : ""})
          </p>
        </div>

        <button
          onClick={handleApply}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-[0.98] flex-shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Apply to Notes</span>
        </button>
      </div>
    </div>
  );
}
