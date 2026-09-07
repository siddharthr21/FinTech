"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { InvestigationReport } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import AnalystSignIn from "@/components/AnalystSignIn";
import RiskSpeedometer from "@/components/RiskSpeedometer";
import WhatIfRiskSimulator from "@/components/WhatIfRiskSimulator";
import PipelineStepper from "@/components/PipelineStepper";
import KeyboardShortcutsModal from "@/components/KeyboardShortcutsModal";
import { soundManager } from "@/lib/sound";
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
  Search,
  Copy,
  Check,
  Sliders,
  Cpu,
  Keyboard,
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
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const [showRawJsonModal, setShowRawJsonModal] = useState<boolean>(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [detailSubTab, setDetailSubTab] = useState<"findings" | "pipeline" | "simulator">("findings");
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const selectCase = useCallback((id: string) => {
    setSelectedReportId(id);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    setMobileTab("detail");
    const target = reports.find((r) => r.report_id === id);
    if (target && target.confidence_score >= 75) {
      soundManager.playRadarPing();
    } else {
      soundManager.playClick();
    }
  }, [reports]);

  const copyToClipboard = (text: string, fieldId: string) => {
    soundManager.playClick();
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    setTimeout(() => setCopiedField(null), 1800);
  };

  const handleDecision = useCallback(async (decision: "Approved-Fraud" | "False-Positive" | "Escalated") => {
    if (!selectedReport) return;
    if (!analyst) {
      soundManager.playAlertBuzz();
      setActionErrorMessage("Authentication required (Handbook Layer 1 & 3): Please sign in as an authorized analyst before executing case decisions.");
      return;
    }
    setSubmitting(true);
    setActionSuccessMessage(null);
    setActionErrorMessage(null);

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
        soundManager.playSuccessChime();
        const closedByText = data.closed_by || `${analyst.name} (${analyst.id})`;
        setActionSuccessMessage(`Success: Case marked as ${decision} by ${closedByText}. Audit datastore updated to Closed.`);
        setAnalystNotes("");
        await fetchReports();
      } else {
        soundManager.playAlertBuzz();
        setActionErrorMessage(`Action failed: ${data.error || "Could not persist decision to datastore."}`);
      }
    } catch (err: any) {
      soundManager.playAlertBuzz();
      setActionErrorMessage(`Network error: ${err.message || "Failed to communicate with verification API."}`);
    } finally {
      setSubmitting(false);
    }
  }, [selectedReport, analyst, analystNotes, fetchReports]);

  // Filtered reports with instant search
  const filteredReports = reports.filter((r) => {
    if (filterStatus === "pending" && r.pipeline_status !== "Pending Analyst Review") return false;
    if (filterStatus === "error" && r.pipeline_status !== "Agent Error - Manual Review Required") return false;
    if (filterStatus === "closed" && r.pipeline_status !== "Closed") return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.transaction_id.toLowerCase().includes(q) ||
      r.report_id.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.verdict.toLowerCase().includes(q) ||
      (r.closed_by && r.closed_by.toLowerCase().includes(q))
    );
  });

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInputActive = target.tagName === "INPUT" || target.tagName === "TEXTAREA";

      if (e.key === "Escape") {
        setShowShortcutsModal(false);
        setShowRawJsonModal(false);
        if (isInputActive) {
          (target as HTMLElement).blur();
        }
        return;
      }

      if (isInputActive) return;

      if (e.key === "/" || e.key === "f") {
        e.preventDefault();
        soundManager.playClick();
        searchInputRef.current?.focus();
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        soundManager.playClick();
        setShowShortcutsModal((prev) => !prev);
        return;
      }

      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        if (filteredReports.length === 0) return;
        const currentIndex = filteredReports.findIndex((r) => r.report_id === selectedReportId);
        const nextIndex = currentIndex < filteredReports.length - 1 ? currentIndex + 1 : 0;
        selectCase(filteredReports[nextIndex].report_id);
        return;
      }

      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        if (filteredReports.length === 0) return;
        const currentIndex = filteredReports.findIndex((r) => r.report_id === selectedReportId);
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : filteredReports.length - 1;
        selectCase(filteredReports[prevIndex].report_id);
        return;
      }

      if (e.key === "1") {
        e.preventDefault();
        soundManager.playClick();
        handleDecision("Approved-Fraud");
        return;
      }

      if (e.key === "2") {
        e.preventDefault();
        soundManager.playClick();
        handleDecision("False-Positive");
        return;
      }

      if (e.key === "3") {
        e.preventDefault();
        soundManager.playClick();
        handleDecision("Escalated");
        return;
      }
    };

    const handleToggleShortcuts = () => {
      setShowShortcutsModal((prev) => !prev);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("toggle-shortcuts-modal", handleToggleShortcuts);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("toggle-shortcuts-modal", handleToggleShortcuts);
    };
  }, [filteredReports, selectedReportId, selectCase, handleDecision]);

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
        <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-terminal-sm">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs">
              <strong>Guest Preview Mode:</strong> Case dispositions (Approve, False Positive, Escalate) require certified investigator sign-off.
            </span>
          </div>
          <button
            onClick={() => setBrowseGuest(false)}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold transition flex items-center gap-1.5 shadow-sm flex-shrink-0 active:scale-[0.98]"
          >
            <span>Sign In to Investigator Portal</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Global Error Banner */}
      {actionErrorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-center justify-between gap-3 shadow-terminal-sm">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs">{actionErrorMessage}</span>
          </div>
          <button
            onClick={() => setActionErrorMessage(null)}
            className="text-rose-400 hover:text-white text-xs font-bold px-2 py-0.5"
          >
            &times;
          </button>
        </div>
      )}

      {loadError && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-200 flex items-start gap-3 shadow-terminal-sm">
          <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold font-mono block text-rose-300">Datastore unavailable &mdash; queue may be incomplete</span>
            <span className="text-[11px] font-mono">{loadError}</span>
          </div>
        </div>
      )}

      {/* Top Metric Strip (Cockpit Telemetry) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-3.5 sm:p-4 shadow-terminal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">Total Cases</span>
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">{totalCases}</span>
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-500">live feed</span>
          </div>
        </div>

        <div className="bg-[#0e131f] border border-[#2d1b24] rounded-xl p-3.5 sm:p-4 shadow-terminal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-rose-400 truncate">Likely Fraud</span>
            <ShieldAlert className="w-4 h-4 text-rose-400 flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-400">{highRiskCount}</span>
            <span className="text-[10px] sm:text-[11px] font-mono text-rose-400/60 truncate">&ge; 75 score</span>
          </div>
        </div>

        <div className="bg-[#0e131f] border border-[#2d2417] rounded-xl p-3.5 sm:p-4 shadow-terminal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-amber-400 truncate">Pending Review</span>
            <Clock className="w-4 h-4 text-amber-400 flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-400">{pendingCount}</span>
            <span className="text-[10px] sm:text-[11px] font-mono text-amber-400/60 truncate">checkpoint gate</span>
          </div>
        </div>

        <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-3.5 sm:p-4 shadow-terminal-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-mono font-semibold uppercase tracking-wider text-purple-400 truncate">Guardrails</span>
            <Lock className="w-4 h-4 text-purple-400 flex-shrink-0" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5 sm:gap-2">
            <span className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-purple-300">{errorCount > 0 ? `${errorCount} Escalate` : "100%"}</span>
            <span className="text-[10px] sm:text-[11px] font-mono text-slate-500 truncate">deterministic</span>
          </div>
        </div>
      </div>

      {/* Mobile View Switcher (Visible only on screens < lg) */}
      <div className="lg:hidden flex items-center bg-[#090d15] border border-[#1c2438] rounded-xl p-1 gap-1 shadow-terminal-sm">
        <button
          onClick={() => setMobileTab("queue")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
            mobileTab === "queue"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <ListFilter className="w-3.5 h-3.5" />
          <span>Case Queue ({filteredReports.length})</span>
        </button>
        <button
          onClick={() => setMobileTab("detail")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] ${
            mobileTab === "detail"
              ? "bg-blue-600 text-white shadow-sm"
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
        <div className={`lg:col-span-4 bg-[#0e131f] border border-[#1d2538] rounded-xl overflow-hidden shadow-terminal ${mobileTab === "queue" ? "block" : "hidden lg:block"}`}>
          <div className="p-3.5 sm:p-4 border-b border-[#1c2438] flex items-center justify-between bg-[#090d15]">
            <div>
              <h2 className="font-semibold text-sm text-slate-100">Investigation Queue</h2>
              <p className="text-[11px] font-mono text-slate-400">Ranked by risk fusion score</p>
            </div>
            <button
              onClick={fetchReports}
              title="Refresh queue"
              className="p-1.5 rounded-lg bg-[#141b2b] text-slate-300 hover:text-white hover:bg-[#1a2338] border border-[#222d46] transition active:scale-[0.98]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Instant Search Bar */}
          <div className="px-3 py-2 bg-[#0a0e17] border-b border-[#182133]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tx ID, report, verdict... (/)"
                className="w-full bg-[#070b12] border border-[#1b253b] focus:border-blue-500 rounded-lg pl-8 pr-14 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none transition"
              />
              <div className="absolute right-2 flex items-center gap-1">
                {searchQuery ? (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="text-slate-400 hover:text-white text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#131a2a] border border-[#1e273e]"
                  >
                    Clear
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-slate-400 bg-[#121826] border border-[#1e273d] rounded">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="px-3 py-2 bg-[#090d15]/80 border-b border-[#182133] flex gap-1.5 text-xs font-mono overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-2.5 py-1 rounded font-medium transition active:scale-[0.98] flex-shrink-0 ${
                filterStatus === "all" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:bg-[#151d2e] border border-transparent hover:border-[#1d273e]"
              }`}
            >
              All ({reports.length})
            </button>
            <button
              onClick={() => setFilterStatus("pending")}
              className={`px-2.5 py-1 rounded font-medium transition active:scale-[0.98] flex-shrink-0 ${
                filterStatus === "pending" ? "bg-amber-600 text-white shadow-sm" : "text-slate-400 hover:bg-[#151d2e] border border-transparent hover:border-[#1d273e]"
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilterStatus("error")}
              className={`px-2.5 py-1 rounded font-medium transition active:scale-[0.98] flex-shrink-0 ${
                filterStatus === "error" ? "bg-rose-700 text-white shadow-sm" : "text-slate-400 hover:bg-[#151d2e] border border-transparent hover:border-[#1d273e]"
              }`}
            >
              Agent Error ({errorCount})
            </button>
            <button
              onClick={() => setFilterStatus("closed")}
              className={`px-2.5 py-1 rounded font-medium transition active:scale-[0.98] flex-shrink-0 ${
                filterStatus === "closed" ? "bg-slate-700 text-white shadow-sm" : "text-slate-400 hover:bg-[#151d2e] border border-transparent hover:border-[#1d273e]"
              }`}
            >
              Closed
            </button>
          </div>

          {/* Queue List */}
          <div className="divide-y divide-[#161f32] max-h-[580px] sm:max-h-[720px] overflow-y-auto">
            {filteredReports.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs font-mono">No cases match the selected filter.</div>
            ) : (
              filteredReports.map((report) => {
                const isSelected = selectedReport?.report_id === report.report_id;
                const isError = report.pipeline_status === "Agent Error - Manual Review Required";
                const isClosed = report.pipeline_status === "Closed";

                let scoreColor = "text-emerald-400 bg-emerald-950/50 border-emerald-800/70";
                if (report.confidence_score >= 75) {
                  scoreColor = "text-rose-400 bg-rose-950/50 border-rose-800/70";
                } else if (report.confidence_score >= 40) {
                  scoreColor = "text-amber-400 bg-amber-950/50 border-amber-800/70";
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
                        ? "bg-[#131b2c] border-l-4 border-blue-500 shadow-terminal-sm"
                        : "hover:bg-[#111726]/60"
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {!isClosed && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0"></span>
                        )}
                        <span className="text-xs font-mono font-bold text-slate-100 truncate">
                          {report.transaction_id}
                        </span>
                        {isError && (
                          <span className="px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-[10px] font-mono uppercase">
                            Ch.8 Error
                          </span>
                        )}
                        {isClosed && (
                          <span className="px-1.5 py-0.5 rounded bg-[#0b101a] border border-[#1f2c44] text-slate-300 text-[10px] font-mono flex items-center gap-1">
                            <span>{report.analyst_decision || "Closed"}</span>
                            {report.closed_by && (
                              <span className="text-emerald-400 font-normal">
                                &bull; {report.closed_by.split(" ")[0]}
                              </span>
                            )}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-1 leading-snug font-sans">
                        {report.summary}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                        <span className="text-slate-400">{report.verdict}</span>
                        <span>&bull;</span>
                        <span>{new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded font-mono font-bold border tabular-nums ${scoreColor}`}>
                        {report.confidence_score}%
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
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
            <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-8 sm:p-12 text-center text-slate-500 shadow-terminal">
              <FileSearch className="w-12 h-12 mx-auto mb-3 text-slate-600" />
              <p className="text-xs sm:text-sm font-mono">Select a case from the queue to inspect findings and evidence.</p>
              <button
                onClick={() => setMobileTab("queue")}
                className="mt-3 lg:hidden px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-mono font-bold inline-flex items-center gap-1.5 active:scale-[0.98]"
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
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-mono font-semibold py-1.5 px-3 rounded-lg bg-[#0e1422] border border-[#1d2840] transition shadow-terminal-sm active:scale-[0.98]"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>&larr; Back to Case Queue</span>
                </button>
                <span className="text-[11px] text-slate-400 font-mono">
                  Case {reports.findIndex(r => r.report_id === selectedReport?.report_id) + 1} of {reports.length}
                </span>
              </div>

              {/* Case Header Card */}
              <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-4 sm:p-5 shadow-terminal">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1b2336] pb-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base sm:text-lg font-bold text-white font-mono tracking-tight">{selectedReport.transaction_id}</h2>
                      
                      {/* Copy TX ID Button */}
                      <button
                        onClick={() => copyToClipboard(selectedReport.transaction_id, "tx")}
                        title="Copy transaction ID"
                        className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#131b2b] hover:bg-[#1a253c] text-blue-300 border border-[#22314e] transition active:scale-[0.96]"
                      >
                        {copiedField === "tx" ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Copied TX</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-400" />
                            <span>Copy TX</span>
                          </>
                        )}
                      </button>

                      {/* Copy Report ID Button */}
                      <button
                        onClick={() => copyToClipboard(selectedReport.report_id, "rep")}
                        title="Copy report ID"
                        className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-[#090d15] hover:bg-[#121927] text-slate-300 border border-[#1b253b] transition truncate max-w-[200px] active:scale-[0.96]"
                      >
                        {copiedField === "rep" ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Copied ID</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-slate-500" />
                            <span className="truncate">{selectedReport.report_id}</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed font-sans">{selectedReport.summary}</p>
                    {selectedReport.model_id && (
                      <p className="text-[10px] text-slate-500 mt-1 font-mono truncate" title="Model, pipeline, and prompt version that produced this verdict">
                        {selectedReport.model_provider}/{selectedReport.model_id} &middot; pipeline v{selectedReport.pipeline_version} &middot; prompts v{selectedReport.prompt_version}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#1a2234]">
                    <button
                      onClick={() => setShowRawJsonModal(true)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#121927] hover:bg-[#182133] text-xs font-mono text-slate-300 border border-[#1f2a40] flex items-center gap-1.5 transition flex-shrink-0 active:scale-[0.98]"
                    >
                      <Eye className="w-3.5 h-3.5 text-blue-400" />
                      Audit Raw JSON
                    </button>

                    {/* Animated SVG Radial Risk Speedometer */}
                    <div className="flex-shrink-0 flex items-center justify-center">
                      <RiskSpeedometer score={selectedReport.confidence_score} />
                    </div>
                  </div>
                </div>

                {/* Pipeline Status Banner */}
                <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-500">Verdict:</span>
                    <span
                      className={`font-semibold px-2.5 py-0.5 rounded-full ${
                        selectedReport.verdict === "Likely Fraud"
                          ? "bg-rose-950/60 text-rose-300 border border-rose-800"
                          : selectedReport.verdict === "Needs Review"
                          ? "bg-amber-950/60 text-amber-300 border border-amber-800"
                          : "bg-emerald-950/60 text-emerald-300 border border-emerald-800"
                      }`}
                    >
                      {selectedReport.verdict}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-slate-500">Pipeline Status:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-medium ${
                        selectedReport.pipeline_status === "Agent Error - Manual Review Required"
                          ? "bg-rose-950 text-rose-200 border border-rose-700"
                          : selectedReport.pipeline_status === "Closed"
                          ? "bg-[#111726] text-slate-300 border border-[#1e2942]"
                          : "bg-amber-950/70 text-amber-200 border border-amber-700"
                      }`}
                    >
                      {selectedReport.pipeline_status}
                    </span>
                  </div>
                </div>

                {/* Chapter 8.1 Error Notice Banner */}
                {selectedReport.pipeline_status === "Agent Error - Manual Review Required" && (
                  <div className="mt-4 p-3.5 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold font-mono block text-rose-300">
                        Oversight Layer 2 / Chapter 8.1 Non-Retryable Error Handled:
                      </span>
                      An agent produced a schema validation failure. Following Handbook Chapter 8.1, the pipeline
                      explicitly halted rather than guessing a fallback score or retrying indefinitely. Human manual
                      review is mandated before resolution.
                    </div>
                  </div>
                )}
              </div>

              {/* Interactive Sub-tab Bar */}
              <div className="flex items-center gap-1.5 p-1 bg-[#090d15] border border-[#1c2438] rounded-xl text-xs font-mono shadow-terminal-sm overflow-x-auto scrollbar-none">
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setDetailSubTab("findings");
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition flex-shrink-0 active:scale-[0.98] ${
                    detailSubTab === "findings"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#131b2c]"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Findings &amp; Evidence</span>
                </button>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setDetailSubTab("pipeline");
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition flex-shrink-0 active:scale-[0.98] ${
                    detailSubTab === "pipeline"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#131b2c]"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Execution Pipeline</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#090e18] text-blue-300 border border-[#1a2844]">
                    5-Stage
                  </span>
                </button>
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setDetailSubTab("simulator");
                  }}
                  className={`px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 transition flex-shrink-0 active:scale-[0.98] ${
                    detailSubTab === "simulator"
                      ? "bg-purple-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-[#131b2c]"
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>What-If Sandbox</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950/60 text-purple-300 border border-purple-800">
                    Live
                  </span>
                </button>
              </div>

              {/* Sub-tab 1: Findings & Evidence */}
              {detailSubTab === "findings" && (
                <>

              {/* Specialist Agents Grid: Agent 1 & Agent 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Agent 1: Transaction-Pattern Findings */}
                <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-4 space-y-3 shadow-terminal-sm">
                  <div className="flex items-center justify-between border-b border-[#1b2336] pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-[#101728] border border-[#1e2e50] text-blue-300 flex items-center justify-center text-xs font-bold font-mono">
                        A1
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                          Transaction-Pattern Agent
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">Velocity, Geography, Amount, Merchant</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#101728] text-blue-300 border border-[#1e2e50] font-mono">
                      Specialist
                    </span>
                  </div>

                  {selectedReport.detected_patterns.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#090d15] border border-[#1b2438] text-xs font-mono text-slate-500 text-center">
                      No pattern anomalies detected. Baseline normal.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedReport.detected_patterns.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[#090d15] border border-[#1b2438] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-blue-300 uppercase tracking-wide font-mono">
                              {item.anomaly_type}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#121927] text-slate-300 border border-[#1e273d]">
                              Severity: {item.severity}/100
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.explanation}</p>
                          {item.evidence && (
                            <div className="text-[11px] bg-[#070a10] p-2 rounded border border-[#172033] text-slate-400 space-y-0.5 font-mono">
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
                <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-4 space-y-3 shadow-terminal-sm">
                  <div className="flex items-center justify-between border-b border-[#1b2336] pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded bg-[#1a1226] border border-[#35224e] text-purple-300 flex items-center justify-center text-xs font-bold font-mono">
                        A2
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-mono">
                          Customer-History Agent
                        </h3>
                        <p className="text-[10px] text-slate-500 font-mono">Account Maturity, Credential Churn, Tickets</p>
                      </div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1a1226] text-purple-300 border border-[#35224e] font-mono">
                      Specialist
                    </span>
                  </div>

                  {selectedReport.customer_context.length === 0 ? (
                    <div className="p-4 rounded-lg bg-[#090d15] border border-[#1b2438] text-xs font-mono text-slate-500 text-center">
                      No contextual risk signals. Account history clean.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedReport.customer_context.map((item, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[#090d15] border border-[#1b2438] space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-purple-300 uppercase tracking-wide font-mono">
                              {item.signal_type.replace("_", " ")}
                            </span>
                            <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[#121927] text-slate-300 border border-[#1e273d]">
                              Severity: {item.severity}/100
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.explanation}</p>
                          {item.evidence && (
                            <div className="text-[11px] bg-[#070a10] p-2 rounded border border-[#172033] text-slate-400 space-y-0.5 font-mono">
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
              <div className="bg-[#0e131f] border border-[#1d2538] rounded-xl p-5 space-y-4 shadow-terminal">
                <div className="flex items-center justify-between border-b border-[#1b2336] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded bg-[#10192e] border border-[#1e2f57] text-blue-300 flex items-center justify-center text-xs font-bold font-mono">
                      A3
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Risk-Scoring Agent (Fusion Layer)
                        <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Cross-references Agent 1 & 2 outputs (Applies Corroboration Bonus / Isolated Discount)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded bg-[#10192e] text-blue-300 border border-[#1e2f57] font-mono">
                    Ch.3.3 Orchestrator
                  </span>
                </div>

                {/* Fused Reasoning Box */}
                <div className="p-3.5 rounded-lg bg-[#090d15] border border-[#1b2438]">
                  <span className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                    Fused Multi-Agent Synthesis:
                  </span>
                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {selectedReport.fused_reasoning}
                  </p>
                </div>

                {/* Traceable Evidence Trail Checklist */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Traceable Evidence Trail (Zero Hallucination Audit)</span>
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      <span className="hidden sm:inline">Every claim grounded to source data field</span>
                      <span className="sm:hidden text-blue-400 font-medium">&bull; Scroll table &rarr;</span>
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-[#1b2438] rounded-lg -mx-1 sm:mx-0">
                    <table className="w-full text-left text-xs min-w-[520px]">
                      <thead className="bg-[#090d15] text-slate-400 border-b border-[#1b2438] font-mono text-[11px]">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold">Evidence Claim</th>
                          <th className="py-2.5 px-3 font-semibold">Source Agent</th>
                          <th className="py-2.5 px-3 font-semibold">Source Field / Record</th>
                          <th className="py-2.5 px-3 font-semibold">Weight</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#172033] text-slate-300 font-sans">
                        {selectedReport.evidence_trail.map((ev, i) => (
                          <tr key={i} className="hover:bg-[#121929]/50 transition">
                            <td className="py-2.5 px-3 font-medium text-slate-200">{ev.claim}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-blue-300">{ev.source_agent}</td>
                            <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">{ev.source_field}</td>
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
              </>
              )}

              {/* Sub-tab 2: Execution Pipeline Stepper */}
              {detailSubTab === "pipeline" && (
                <PipelineStepper report={selectedReport} />
              )}

              {/* Sub-tab 3: What-If Risk Simulator Sandbox */}
              {detailSubTab === "simulator" && (
                <WhatIfRiskSimulator
                  baseScore={selectedReport.confidence_score}
                  detectedPatterns={selectedReport.detected_patterns}
                  customerContext={selectedReport.customer_context}
                  onApplyHypothesis={(notes) => {
                    setAnalystNotes((prev) => (prev ? prev + "\n" : "") + notes);
                    setDetailSubTab("findings");
                    soundManager.playSuccessChime();
                  }}
                />
              )}

              {/* Human Checkpoint Action Bar (Layer 3 Oversight) */}
              <div className="bg-[#0e131f] border border-[#23304c] rounded-xl p-5 shadow-terminal space-y-4 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />
                <div className="flex items-center justify-between border-b border-[#1b2336] pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded bg-[#0d1829] border border-[#1d355c] text-blue-400 flex items-center justify-center text-xs font-bold font-mono">
                      H
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        Human Checkpoint Action Bar
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#0d1829] text-blue-300 border border-[#1d355c] font-normal">
                          Oversight Layer 3 &bull; Ch.9.3
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 font-mono">
                        Approve-before-execute gate: No case can close without explicit certified sign-off.
                      </p>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-slate-400">
                    Recommended: <span className="font-semibold text-blue-300">{selectedReport.recommended_action}</span>
                  </div>
                </div>

                {/* Active Analyst Signer Context */}
                {analyst ? (
                  <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[#090d15] border border-[#1b253b] text-xs font-mono">
                    <div
                      className={`h-6 w-6 rounded-md bg-[#162035] border border-[#2b3a5c] flex items-center justify-center text-[10px] font-bold text-blue-300 shadow`}
                    >
                      {analyst.initials}
                    </div>
                    <div className="flex-1 flex flex-wrap items-center justify-between gap-1">
                      <div>
                        <span className="text-slate-500">Authorized Investigator:</span>{" "}
                        <span className="font-semibold text-white">{analyst.name}</span>{" "}
                        <span className="text-blue-300">({analyst.id})</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-[#101726] text-blue-300 border border-[#202d4b]">
                        {analyst.tier}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg bg-amber-950/40 border border-amber-800/60 text-xs text-amber-200 font-mono">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <span>
                        <strong>Analyst Sign-In Required:</strong> Case dispositions require certified investigator session.
                      </span>
                    </div>
                    <button
                      onClick={() => setBrowseGuest(false)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center gap-1.5 shadow-sm active:scale-[0.98]"
                    >
                      <span>Sign In as Analyst</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {actionSuccessMessage && (
                  <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-700/80 text-xs font-mono text-emerald-200 flex items-center gap-2 shadow-terminal-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{actionSuccessMessage}</span>
                  </div>
                )}

                {actionErrorMessage && (
                  <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/80 text-xs font-mono text-rose-200 flex items-center gap-2 shadow-terminal-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
                    <span>{actionErrorMessage}</span>
                  </div>
                )}

                {/* Analyst Decision History if already closed */}
                {selectedReport.pipeline_status === "Closed" ? (
                  <div className="p-4 rounded-lg bg-[#090d15] border border-[#1b253b] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-semibold">Finalized Analyst Decision:</span>
                        <span className="px-2.5 py-0.5 rounded bg-[#121b2d] text-blue-200 border border-[#223150] font-bold">
                          {selectedReport.analyst_decision}
                        </span>
                      </div>
                      {selectedReport.closed_by && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-300 bg-[#101726] px-2.5 py-1 rounded-md border border-[#1d2942]">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-slate-400">Closed by:</span>
                          <span className="font-bold text-white">{selectedReport.closed_by}</span>
                        </div>
                      )}
                    </div>

                    {selectedReport.closed_at && (
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>Resolution Timestamp:</span>
                        <span className="text-slate-300 tabular-nums">
                          {new Date(selectedReport.closed_at).toLocaleString()}
                        </span>
                      </div>
                    )}

                    {selectedReport.analyst_notes && (
                      <div className="p-2.5 rounded bg-[#06080d] border border-[#151d2d]">
                        <span className="text-[10px] text-slate-500 font-mono uppercase font-semibold block mb-0.5">
                          Analyst Audit Notes:
                        </span>
                        <p className="text-xs text-slate-300 italic font-sans">
                          &quot;{selectedReport.analyst_notes}&quot;
                        </p>
                      </div>
                    )}
                    <div className="text-[11px] font-mono text-slate-500 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <span>Stopping condition satisfied (Handbook Ch.4.4 &amp; Ch.9.5): Final disposition recorded to audit datastore.</span>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
                        Analyst Rationale / Verification Notes (Logged to Audit Trail)
                      </label>
                      <textarea
                        value={analystNotes}
                        onChange={(e) => setAnalystNotes(e.target.value)}
                        placeholder="Enter corroborated rationale before finalizing case (or use What-If sandbox to auto-fill)..."
                        className="w-full bg-[#090d15] border border-[#1c2538] rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                        rows={2}
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-1 font-mono">
                      {/* Button 1: Approve as Fraud */}
                      <button
                        onClick={() => handleDecision("Approved-Fraud")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition min-h-[44px] active:scale-[0.98] group"
                      >
                        <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                        <span>Confirm Fraud</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-rose-200 bg-rose-900/60 rounded border border-rose-500/50">
                          1
                        </kbd>
                      </button>

                      {/* Button 2: Mark False Positive */}
                      <button
                        onClick={() => handleDecision("False-Positive")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition min-h-[44px] active:scale-[0.98] group"
                      >
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span>Clear Suspicion</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-emerald-200 bg-emerald-900/60 rounded border border-emerald-500/50">
                          2
                        </kbd>
                      </button>

                      {/* Button 3: Escalate for Manual Review */}
                      <button
                        onClick={() => handleDecision("Escalated")}
                        disabled={submitting || !analyst}
                        title={!analyst ? "Sign in as an analyst to enable" : undefined}
                        className="w-full sm:flex-1 py-3 sm:py-2.5 px-3 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition min-h-[44px] active:scale-[0.98] group"
                      >
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <span>Escalate to SAR</span>
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono text-amber-200 bg-amber-900/60 rounded border border-amber-500/50">
                          3
                        </kbd>
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
          <div className="bg-[#0e131f] border border-[#232f48] rounded-xl max-w-3xl w-full max-h-[92vh] sm:max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 sm:p-4 border-b border-[#1b2336] bg-[#090d15] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-white font-mono truncate">
                  Audit Raw JSON: {selectedReport.report_id}
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-400 font-mono line-clamp-1">
                  Action-Level Guardrail Output (Deterministic code assembly)
                </p>
              </div>
              <button
                onClick={() => setShowRawJsonModal(false)}
                className="p-1.5 rounded-lg bg-[#141b2a] text-slate-400 hover:text-white border border-[#202b40] flex-shrink-0 transition active:scale-[0.98]"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 sm:p-4 overflow-x-auto overflow-y-auto flex-1 font-mono text-[11px] sm:text-xs text-emerald-400 bg-[#06080e]">
              <pre>{JSON.stringify(selectedReport, null, 2)}</pre>
            </div>
            <div className="p-2.5 sm:p-3 border-t border-[#1b2336] bg-[#090d15] flex justify-end">
              <button
                onClick={() => setShowRawJsonModal(false)}
                className="px-3 py-1.5 rounded bg-[#141b2a] hover:bg-[#1a2336] text-xs font-mono text-white border border-[#202b40] transition active:scale-[0.98]"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Cheat Sheet Modal */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />
    </div>
  );
}
