"use client";

import React, { useState, useEffect, useCallback } from "react";
import { InvestigationReport } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import AnalystSignIn from "@/components/AnalystSignIn";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  FileSearch,
  ChevronRight,
  RefreshCw,
  Eye,
  Sparkles,
  Lock,
  Database,
  UserCheck,
  Calendar,
  ArrowRight,
  ArrowLeft,
  ListFilter,
  FileText,
} from "lucide-react";

export default function Dashboard() {
  const { analyst, loading: authLoading } = useAuth();
  const [browseGuest, setBrowseGuest] = useState<boolean>(false);
  const [mobileTab, setMobileTab] = useState<"queue" | "detail">("queue");
  const [reports, setReports] = useState<InvestigationReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [analystNotes, setAnalystNotes] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [showRawJsonModal, setShowRawJsonModal] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports", { cache: "no-store" });
      const data = await res.json();
      if (data.success && data.reports) {
        setLoadError(null);
        setReports(data.reports);
        if (data.reports.length > 0 && !selectedReportId) {
          setSelectedReportId(data.reports[0].report_id);
        }
      } else {
        // An empty queue and an unreachable datastore are not the same thing.
        setLoadError(data.error || "The investigation datastore returned an unexpected response.");
      }
    } catch (e: any) {
      console.error("Failed to load reports:", e);
      setLoadError(e?.message || "Could not reach the investigation datastore.");
    } finally {
      setLoading(false);
    }
  }, [selectedReportId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const selectedReport = reports.find((r) => r.report_id === selectedReportId) || reports[0];

  const handleDecision = async (decision: "Approved-Fraud" | "False-Positive" | "Escalated") => {
    if (!selectedReport) return;
    if (!analyst) {
      alert("Authentication required (Handbook Layer 1 & 3): Please sign in as an authorized analyst before executing case decisions.");
      return;
    }
    setSubmitting(true);
    setActionSuccessMessage(null);

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(selectedReport.report_id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision,
          notes: analystNotes || `Analyst verified and finalized case as ${decision}.`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        const closedByText = data.closed_by || `${analyst.name} (${analyst.id})`;
        setActionSuccessMessage(`Success: Case marked as ${decision} by ${closedByText}. Audit datastore updated to Closed.`);
        setAnalystNotes("");
        // Refresh reports list
        await fetchReports();
      } else {
        alert(`Error: ${data.error || "Failed to update case"}`);
      }
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") return r.pipeline_status === "Pending Analyst Review";
    if (filterStatus === "error") return r.pipeline_status === "Agent Error - Manual Review Required";
    if (filterStatus === "closed") return r.pipeline_status === "Closed";
    return true;
  });

  // Metrics
  const totalCases = reports.length;
  const highRiskCount = reports.filter((r) => r.verdict === "Likely Fraud").length;
  const pendingCount = reports.filter((r) => r.pipeline_status === "Pending Analyst Review").length;
  const errorCount = reports.filter((r) => r.pipeline_status === "Agent Error - Manual Review Required").length;

  // If not authenticated and not in guest preview mode, show the dedicated Sign-In Screen
  if (!analyst && !authLoading && !browseGuest) {
    return <AnalystSignIn onBrowseGuest={() => setBrowseGuest(true)} />;
  }

  return (
    <div className="space-y-6">
      {/* Guest Preview Mode Notice */}
      {!analyst && browseGuest && (
        <div className="p-3.5 rounded-xl bg-amber-950/70 border border-amber-800/80 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              <strong>Guest Preview Mode (Read-Only):</strong> You are exploring the queue without an analyst session. Case dispositions (Approve, False Positive, Escalate) require certified sign-in.
            </span>
          </div>
          <button
            onClick={() => setBrowseGuest(false)}
            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow text-xs flex-shrink-0"
          >
            <span>Sign In to Analyst Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loadError && (
        <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-rose-300">Datastore unavailable &mdash; queue may be incomplete</span>
            {loadError}
          </div>
        </div>
      )}

      {/* Top Metric Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-400">Total Cases</span>
            <Database className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold text-white">{totalCases}</span>
            <span className="text-[11px] sm:text-xs text-slate-400">monitored</span>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-rose-950/60 rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-rose-400 truncate">Likely Fraud</span>
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold text-rose-400">{highRiskCount}</span>
            <span className="text-[11px] sm:text-xs text-rose-400/70 truncate">corroborated</span>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-amber-950/60 rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400 truncate">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold text-amber-400">{pendingCount}</span>
            <span className="text-[11px] sm:text-xs text-amber-400/70 truncate">checkpoint</span>
          </div>
        </div>

        <div className="bg-[#131b2e] border border-slate-800 rounded-xl p-3 sm:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-purple-400 truncate">Guardrails</span>
            <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
          </div>
          <div className="mt-1.5 sm:mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold text-purple-300">{errorCount > 0 ? `${errorCount} Escalate` : "100%"}</span>
            <span className="text-[11px] sm:text-xs text-slate-400 truncate">enforced</span>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher (Visible only on screens < lg) */}
      <div className="lg:hidden flex items-center bg-[#111827] border border-slate-800 rounded-xl p-1 gap-1 shadow-lg">
        <button
          onClick={() => setMobileTab("queue")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            mobileTab === "queue"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Case Queue ({filteredReports.length})</span>
        </button>
        <button
          onClick={() => setMobileTab("detail")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
            mobileTab === "detail"
              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="truncate max-w-[130px]">
            {selectedReport ? selectedReport.transaction_id : "Case Detail"}
          </span>
        </button>
      </div>

      {/* Main Split Layout: Queue vs Case Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Investigation Queue (4 cols on desktop, full width on mobile) */}
        <div className={`lg:col-span-4 bg-[#111827] border border-slate-800 rounded-xl overflow-hidden shadow-xl ${mobileTab === "queue" ? "block" : "hidden lg:block"}`}>
          <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-[#141d33]">
            <div>
              <h2 className="font-semibold text-sm text-slate-200">Investigation Queue</h2>
              <p className="text-[11px] sm:text-xs text-slate-400">Ranked by fusion confidence score</p>
            </div>
            <button
              onClick={fetchReports}
              title="Refresh queue"
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 bg-[#0d1424] border-b border-slate-800/80 flex gap-1.5 text-xs overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 py-1 rounded-md font-medium transition flex-shrink-0 ${
                filterStatus === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilterStatus("pending")}
              className={`px-2.5 py-1 rounded-md font-medium transition flex-shrink-0 ${
                filterStatus === "pending" ? "bg-amber-600 text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus("error")}
              className={`px-2.5 py-1 rounded-md font-medium transition flex-shrink-0 ${
                filterStatus === "error" ? "bg-rose-700 text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              Agent Error ({errorCount})
            </button>
            <button
              onClick={() => setFilterStatus("closed")}
              className={`px-2.5 py-1 rounded-md font-medium transition flex-shrink-0 ${
                filterStatus === "closed" ? "bg-slate-700 text-white" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              Closed
            </button>
          </div>

          {/* Queue List */}
          <div className="divide-y divide-slate-800/60 max-h-[580px] sm:max-h-[720px] overflow-y-auto">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">No cases match the selected filter.</div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedReport?.report_id === report.report_id;
                const isError = report.pipeline_status === "Agent Error - Manual Review Required";
                const isClosed = report.pipeline_status === "Closed";

                let scoreColor = "text-emerald-400 bg-emerald-950/60 border-emerald-800";
                if (report.confidence_score >= 75) {
                  scoreColor = "text-rose-400 bg-rose-950/60 border-rose-800";
                } else if (report.confidence_score >= 40) {
                  scoreColor = "text-amber-400 bg-amber-950/60 border-amber-800";
                }

                return (
                  <div
                    key={report.report_id}
                    onClick={() => {
                      setSelectedReportId(report.report_id);
                      setActionSuccessMessage(null);
                      setMobileTab("detail");
                    }}
                    className={`p-3.5 cursor-pointer transition flex items-start justify-between gap-3 ${
                      isSelected
                        ? "bg-indigo-950/40 border-l-4 border-indigo-500"
                        : "hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-200 truncate">
                          {report.transaction_id}
                        </span>
                        {isError && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-900/80 text-rose-300 text-[10px] font-semibold tracking-wide uppercase">
                            Ch.8 Error
                          </span>
                        )}
                        {isClosed && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold flex items-center gap-1">
                            <span>{report.analyst_decision || "Closed"}</span>
                            {report.closed_by && (
                              <span className="text-emerald-400 font-normal">
                                &bull; {report.closed_by.split(" ")[0]}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1">
                        {report.summary}
                      </p>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{report.verdict}</span>
                        <span>&bull;</span>
                        <span>{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold border ${scoreColor}`}>
                        {report.confidence_score}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Case Detail View (8 cols on desktop, full width on mobile) */}
        <div className={`lg:col-span-8 space-y-4 sm:space-y-6 ${mobileTab === "detail" ? "block" : "hidden lg:block"}`}>
          {!selectedReport ? (
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-8 sm:p-12 text-center text-slate-500">
              <FileSearch className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-xs sm:text-sm">Select a case from the queue to inspect findings and evidence.</p>
              <button
                onClick={() => setMobileTab("queue")}
                className="mt-3 lg:hidden px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Go to Case Queue</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Mobile Back Button */}
              <div className="lg:hidden flex items-center justify-between pb-1">
                <button
                  onClick={() => setMobileTab("queue")}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold py-1.5 px-3 rounded-lg bg-indigo-950/50 border border-indigo-800/60 transition shadow-sm"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>&larr; Back to Case Queue</span>
                </button>
                <span className="text-[11px] text-slate-400 font-mono">
                  Case {reports.findIndex(r => r.report_id === selectedReport?.report_id) + 1} of {reports.length}
                </span>
              </div>

              {/* Case Header Card */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 sm:p-5 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b border-slate-800/80 pb-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-white font-mono">{selectedReport.transaction_id}</h2>
                      <span className="text-[11px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 truncate max-w-[200px]">
                        {selectedReport.report_id}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{selectedReport.summary}</p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800/60">
                    <button
                      onClick={() => setShowRawJsonModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 flex items-center gap-1.5 transition flex-shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Audit Raw JSON
                    </button>

                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] sm:text-xs text-slate-400 font-medium">Confidence Score</div>
                      <div className="text-xl sm:text-2xl font-bold font-mono text-white">
                        {selectedReport.confidence_score}%
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pipeline Status Banner */}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Verdict:</span>
                    <span
                      className={`font-semibold px-2.5 py-0.5 rounded-full ${
                        selectedReport.verdict === "Likely Fraud"
                          ? "bg-rose-950 text-rose-300 border border-rose-800"
                          : selectedReport.verdict === "Needs Review"
                          ? "bg-amber-950 text-amber-300 border border-amber-800"
                          : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {selectedReport.verdict}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-400">Pipeline Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-medium ${
                        selectedReport.pipeline_status === "Agent Error - Manual Review Required"
                          ? "bg-rose-900/80 text-rose-200 border border-rose-700"
                          : selectedReport.pipeline_status === "Closed"
                          ? "bg-slate-800 text-slate-300 border border-slate-700"
                          : "bg-amber-900/60 text-amber-200 border border-amber-700"
                      }`}
                    >
                      {selectedReport.pipeline_status}
                    </span>
                  </div>
                </div>

                {/* Chapter 8.1 Error Notice Banner */}
                {selectedReport.pipeline_status === "Agent Error - Manual Review Required" && (
                  <div className="mt-4 p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-rose-300">
                        Oversight Layer 2 / Chapter 8.1 Non-Retryable Error Handled:
                      </span>
                      An agent produced a schema validation failure. Following Handbook Chapter 8.1, the pipeline
                      explicitly halted rather than guessing a fallback score or retrying indefinitely. Human manual
                      review is mandated before resolution.
                    </div>
                  </div>
                )}
              </div>

              {/* Specialist Agents Grid: Agent 1 & Agent 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent 1: Transaction-Pattern Findings */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-blue-950 border border-blue-800 text-blue-300 flex items-center justify-center text-xs font-bold font-mono">
                        A1
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Transaction-Pattern Agent
                        </h3>
                        <p className="text-[10px] text-slate-400">Velocity, Geography, Amount, Merchant</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-900">
                      Specialist
                    </span>
                  </div>

                  {selectedReport.detected_patterns.length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-500 text-center">
                      No pattern anomalies detected. Baseline normal.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedReport.detected_patterns.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide">
                              {item.anomaly_type}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Severity: {item.severity}/100
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.explanation}</p>
                          {item.evidence && (
                            <div className="text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800/80 text-slate-400 space-y-0.5">
                              <div>
                                <span className="text-slate-500">Observed:</span> {item.evidence.observed_value}
                              </div>
                              {item.evidence.baseline_value && (
                                <div>
                                  <span className="text-slate-500">Baseline:</span> {item.evidence.baseline_value}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Agent 2: Customer-History Findings */}
                <div className="bg-[#111827] border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-purple-950 border border-purple-800 text-purple-300 flex items-center justify-center text-xs font-bold font-mono">
                        A2
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                          Customer-History Agent
                        </h3>
                        <p className="text-[10px] text-slate-400">Account Maturity, Credential Churn, Tickets</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-900">
                      Specialist
                    </span>
                  </div>

                  {selectedReport.customer_context.length === 0 ? (
                    <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-500 text-center">
                      No contextual risk signals. Account history clean.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedReport.customer_context.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide">
                              {item.signal_type.replace("_", " ")}
                            </span>
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                              Severity: {item.severity}/100
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">{item.explanation}</p>
                          {item.evidence && (
                            <div className="text-[11px] bg-slate-950/70 p-2 rounded border border-slate-800/80 text-slate-400 space-y-0.5">
                              <div>
                                <span className="text-slate-500">Source:</span> {item.evidence.source_table} ({item.evidence.source_record_id})
                              </div>
                              <div>
                                <span className="text-slate-500">Observed:</span> {item.evidence.observed_value}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Agent 3: Fusion & Corroboration Card */}
              <div className="bg-[#111827] border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded bg-indigo-950 border border-indigo-700 text-indigo-300 flex items-center justify-center text-xs font-bold font-mono">
                      A3
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Risk-Scoring Agent (Fusion Layer)
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      </h3>
                      <p className="text-xs text-slate-400">
                        Cross-references Agent 1 & 2 outputs (Applies Corroboration Bonus / Isolated Discount)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800 font-mono">
                    Ch.3.3 Orchestrator
                  </span>
                </div>

                {/* Fused Reasoning Box */}
                <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Fused Multi-Agent Synthesis:
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {selectedReport.fused_reasoning}
                  </p>
                </div>

                {/* Traceable Evidence Trail Checklist */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Traceable Evidence Trail (Zero Hallucination Audit)</span>
                    </span>
                    <span className="text-[11px] text-slate-500">
                      <span className="hidden sm:inline">Every claim grounded to source data field</span>
                      <span className="sm:hidden text-indigo-400 font-medium">&bull; Scroll table &rarr;</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-slate-800 rounded-lg -mx-1 sm:mx-0">
                    <table className="w-full text-left text-xs min-w-[520px]">
                      <thead className="bg-[#141d33] text-slate-400 border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Evidence Claim</th>
                          <th className="py-2.5 px-3 font-semibold">Source Agent</th>
                          <th className="py-2.5 px-3 font-semibold">Source Field / Record</th>
                          <th className="py-2.5 px-3 font-semibold">Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-slate-300">
                        {selectedReport.evidence_trail.map((ev, i) => (
                          <tr key={i} className="hover:bg-slate-800/30">
                            <td className="py-2 px-3 font-medium text-slate-200">{ev.claim}</td>
                            <td className="py-2 px-3 font-mono text-[11px] text-indigo-300">{ev.source_agent}</td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-400">{ev.source_field}</td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  ev.weight === "high"
                                    ? "bg-rose-950 text-rose-300 border border-rose-800"
                                    : ev.weight === "medium"
                                    ? "bg-amber-950 text-amber-300 border border-amber-800"
                                    : "bg-slate-800 text-slate-300 border border-slate-700"
                                }`}
                              >
                                {ev.weight}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Human Checkpoint Action Bar (Layer 3 Oversight) */}
              <div className="bg-[#111827] border-2 border-indigo-900/70 rounded-xl p-5 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-emerald-950 border border-emerald-700 text-emerald-300 flex items-center justify-center text-xs font-bold">
                      H
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Human Checkpoint Action Bar
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-normal">
                          Oversight Layer 3 &bull; Ch.9.3
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400">
                        Approve-before-execute gate: No case can close or execute without explicit human sign-off.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    Recommended: <span className="font-semibold text-indigo-300">{selectedReport.recommended_action}</span>
                  </div>
                </div>

                {/* Active Analyst Signer Context */}
                {analyst ? (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-indigo-950/60 border border-indigo-800/70 text-xs">
                    <div
                      className={`h-6 w-6 rounded-full bg-gradient-to-br ${analyst.badgeColor || "from-indigo-600 to-indigo-800"} flex items-center justify-center text-[10px] font-bold text-white shadow`}
                    >
                      {analyst.initials}
                    </div>
                    <div className="flex-1 flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <span className="text-slate-400">Authorized Investigator:</span>{" "}
                        <span className="font-bold text-white">{analyst.name}</span>{" "}
                        <span className="font-mono text-[11px] text-indigo-300">({analyst.id})</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-900 text-indigo-200 border border-indigo-700 font-mono">
                        {analyst.tier}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-950/60 border border-amber-800/70 text-xs text-amber-200">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        <strong>Analyst Sign-In Required:</strong> Human checkpoint decisions (Approve, False Positive, Escalate) require certified sign-off.
                      </span>
                    </div>
                    <button
                      onClick={() => setBrowseGuest(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-1.5 shadow"
                    >
                      <span>Sign In as Analyst</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {actionSuccessMessage && (
                  <div className="p-3 rounded-lg bg-emerald-950/80 border border-emerald-700 text-xs text-emerald-200 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{actionSuccessMessage}</span>
                  </div>
                )}

                {/* Analyst Decision History if already closed */}
                {selectedReport.pipeline_status === "Closed" ? (
                  <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-semibold">Finalized Analyst Decision:</span>
                        <span className="px-2.5 py-0.5 rounded bg-indigo-900 text-indigo-200 font-bold font-mono">
                          {selectedReport.analyst_decision}
                        </span>
                      </div>
                      {selectedReport.closed_by && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/90 px-2.5 py-1 rounded-md border border-slate-700">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-slate-400">Closed by:</span>
                          <span className="font-bold text-white">{selectedReport.closed_by}</span>
                        </div>
                      )}
                    </div>

                    {selectedReport.closed_at && (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Resolution Timestamp:</span>
                        <span className="font-mono text-slate-300">
                          {new Date(selectedReport.closed_at).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {selectedReport.analyst_notes && (
                      <div className="p-2.5 rounded bg-[#090d16] border border-slate-800">
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block mb-0.5">
                          Analyst Audit Notes:
                        </span>
                        <p className="text-xs text-slate-300 italic">
                          &quot;{selectedReport.analyst_notes}&quot;
                        </p>
                      </div>
                    )}
                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Stopping condition satisfied (Handbook Ch.4.4 &amp; Ch.9.5): Final disposition recorded to audit datastore.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Analyst Notes / Rationale (Logged with Analyst Attribution to Audit Trail)
                      </label>
                      <textarea
                        value={analystNotes}
                        onChange={(e) => setAnalystNotes(e.target.value)}
                        placeholder="Enter justification or corroborated audit notes before taking action..."
                        className="w-full bg-[#0a0e1a] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1">
                      {/* Button 1: Approve as Fraud */}
                      <button
                        onClick={() => handleDecision("Approved-Fraud")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-600/20 transition min-h-[44px]"
                      >
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <span>Approve as Fraud</span>
                      </button>

                      {/* Button 2: Mark False Positive */}
                      <button
                        onClick={() => handleDecision("False-Positive")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/20 transition min-h-[44px]"
                      >
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span>Mark False Positive</span>
                      </button>

                      {/* Button 3: Escalate for Manual Review */}
                      <button
                        onClick={() => handleDecision("Escalated")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-4 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/20 transition min-h-[44px]"
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Escalate for Review</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw JSON Audit Modal */}
      {showRawJsonModal && selectedReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4">
          <div className="bg-[#111827] border border-slate-700 rounded-xl max-w-3xl w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                  Audit Raw JSON: {selectedReport.report_id}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 line-clamp-1">
                  Action-Level Guardrail Output (Deterministic code assembly)
                </p>
              </div>
              <button
                onClick={() => setShowRawJsonModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex-shrink-0"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-x-auto overflow-y-auto flex-1 font-mono text-[11px] sm:text-xs text-emerald-400 bg-[#090d16]">
              <pre>{JSON.stringify(selectedReport, null, 2)}</pre>
            </div>
            <div className="p-2.5 sm:p-3 border-t border-slate-800 bg-[#141d33] flex justify-end">
              <button
                onClick={() => setShowRawJsonModal(false)}
                className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs text-white"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
