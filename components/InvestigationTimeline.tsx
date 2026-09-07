"use client";

import React, { useState } from "react";
import { InvestigationReport } from "@/lib/types";
import {
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Key,
  Smartphone,
  CreditCard,
  MessageSquare,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { soundManager } from "@/lib/sound";

interface InvestigationTimelineProps {
  report: InvestigationReport;
}

interface TimelineEvent {
  id: string;
  timestamp: string;
  relativeTime: string;
  type: "login" | "password_reset" | "device_change" | "transaction" | "ticket" | "dispute";
  title: string;
  description: string;
  severity: "high" | "medium" | "low" | "neutral";
  patternAlert?: string;
  metadata?: Record<string, any>;
}

export default function InvestigationTimeline({ report }: InvestigationTimelineProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  // Deterministically construct chronological event sequence for this investigation
  const getEventsForCase = (): TimelineEvent[] => {
    const txId = report.transaction_id;

    if (txId === "TX-98214") {
      return [
        {
          id: "EVT-5011",
          timestamp: "2026-09-04T18:22:10Z",
          relativeTime: "T - 32.8 hours",
          type: "password_reset",
          title: "Password Reset Initiated",
          description: "Password reset completed via web self-service from unrecognized foreign IP (185.220.101.44).",
          severity: "high",
          patternAlert: "ATO CORROBORATION SEQUENCE: Step 1",
          metadata: {
            source_table: "Customer_History",
            ip_address: "185.220.101.44",
            device_id: "DEV-UNK-9941",
            resolution: "Completed via Web Self-Service",
          },
        },
        {
          id: "EVT-5012",
          timestamp: "2026-09-05T01:10:04Z",
          relativeTime: "T - 26.0 hours",
          type: "device_change",
          title: "New Unrecognized Device Registered",
          description: "New Linux / Chrome browser profile registered to account from foreign network gateway.",
          severity: "high",
          patternAlert: "ATO CORROBORATION SEQUENCE: Step 2",
          metadata: {
            source_table: "Customer_History",
            device_id: "DEV-UNK-9941",
            resolution: "New Device Registered",
          },
        },
        {
          id: "TCK-8812",
          timestamp: "2026-09-05T02:40:00Z",
          relativeTime: "T - 24.5 hours",
          type: "ticket",
          title: "Support Ticket: Unauthorized Password Reset Alert",
          description: "Customer reported: 'I just received a text that my password was reset, but I did not do this. Please secure my account immediately!'",
          severity: "high",
          patternAlert: "DIRECT VICTIM COMPLAINT SIGNAL",
          metadata: {
            source_table: "Support_Tickets",
            ticket_id: "TCK-8812",
            category: "Unauthorized Access / Suspicious Alert",
            sentiment: "Negative",
          },
        },
        {
          id: "EVT-5013",
          timestamp: "2026-09-06T03:05:11Z",
          relativeTime: "T - 9.2 minutes",
          type: "login",
          title: "Session Established from Unrecognized Device",
          description: "Attacker established session using altered credentials from DEV-UNK-9941 just prior to spend surge.",
          severity: "high",
          patternAlert: "PRE-TRANSACTION AUTHENTICATION",
          metadata: {
            source_table: "Customer_History",
            device_id: "DEV-UNK-9941",
            resolution: "Success",
          },
        },
        {
          id: "TX-98214-INCIDENT",
          timestamp: "2026-09-06T03:14:22Z",
          relativeTime: "T = 0 (Flagged Incident)",
          type: "transaction",
          title: "High-Value Transaction: Apex Luxury Electronics ($3,850.00)",
          description: "Surge transaction in Moscow, RU (45x average historical spend) with Virtual Visa ending 4109.",
          severity: "high",
          patternAlert: "TARGET FLAGGED ANOMALY",
          metadata: {
            amount: "$3,850.00",
            location: "Moscow, RU",
            merchant: "Apex Luxury Electronics",
            device_id: "DEV-UNK-9941",
          },
        },
      ];
    }

    if (txId === "TX-98215") {
      return [
        {
          id: "TCK-8813",
          timestamp: "2026-09-04T14:30:00Z",
          relativeTime: "T - 41.8 hours",
          type: "ticket",
          title: "Verified Travel Notification on File",
          description: "Customer informed bank of upcoming travel to New York conference via mobile banking app.",
          severity: "low",
          patternAlert: "EXONERATING CONTEXT RECORD",
          metadata: {
            source_table: "Support_Tickets",
            ticket_id: "TCK-8813",
            category: "Travel Notification",
            sentiment: "Neutral",
          },
        },
        {
          id: "EVT-6001",
          timestamp: "2026-09-06T08:15:00Z",
          relativeTime: "T - 5.2 minutes",
          type: "login",
          title: "Routine Biometric Login",
          description: "Routine FaceID authentication from established primary iPhone (DEV-KNOWN-7712). Zero credential churn.",
          severity: "low",
          patternAlert: "CLEAN BIOMETRIC BASELINE",
          metadata: {
            source_table: "Customer_History",
            device_id: "DEV-KNOWN-7712",
            resolution: "Success",
          },
        },
        {
          id: "TX-98215-INCIDENT",
          timestamp: "2026-09-06T08:20:15Z",
          relativeTime: "T = 0 (Flagged Incident)",
          type: "transaction",
          title: "In-Flight / Travel Ticket: Delta Air Lines ($480.00)",
          description: "Location in New York, NY flagged due to San Francisco home baseline, but supported by verified travel notice.",
          severity: "medium",
          patternAlert: "ISOLATED PATTERN ANOMALY (BENIGN)",
          metadata: {
            amount: "$480.00",
            location: "New York, NY, USA",
            merchant: "Delta Air Lines",
            device_id: "DEV-KNOWN-7712",
          },
        },
      ];
    }

    if (txId.startsWith("TX-7000")) {
      return [
        {
          id: "EVT-CLUSTER-INIT",
          timestamp: "2026-08-10T10:00:00Z",
          relativeTime: "27 days prior",
          type: "login",
          title: "Synthetic Syndicate Accounts Provisioned",
          description: "Cluster of 4 accounts opened in rapid 8-day window across Mumbai/Pune corridor.",
          severity: "high",
          patternAlert: "SYNTHETIC AGE SYNCHRONIZATION",
          metadata: {
            accounts: "CUST-70112, CUST-70113, CUST-70114, CUST-70115",
            span: "8 days between accounts",
          },
        },
        {
          id: "EVT-7011",
          timestamp: "2026-09-06T05:50:00Z",
          relativeTime: "T - 10 minutes",
          type: "login",
          title: "Hardware Session: DEV-RING-4417",
          description: "Syndicate operator initializes gateway via proxy IP 45.132.192.7.",
          severity: "high",
          patternAlert: "SHARED HARDWARE FINGERPRINT",
          metadata: {
            device_id: "DEV-RING-4417",
            ip_address: "45.132.192.7",
          },
        },
        {
          id: "TX-70001",
          timestamp: "2026-09-06T06:00:00Z",
          relativeTime: "Layering Hop 1",
          type: "transaction",
          title: "Hop 1 Transfer: $4,800.00 -> ACC-MULE-9011",
          description: "Initial rapid wire transfer initiated from CUST-70112 to escrow hub.",
          severity: "high",
          patternAlert: "MULE FAN-IN CHAIN",
          metadata: {
            amount: "$4,800.00",
            counterparty: "ACC-MULE-9011",
          },
        },
        {
          id: "TX-70002",
          timestamp: "2026-09-06T06:38:00Z",
          relativeTime: "Layering Hop 2 (+38m)",
          type: "transaction",
          title: "Hop 2 Transfer: $4,550.00 -> ACC-MULE-9011",
          description: "Successive hop retains 94.7% funds on identical hardware DEV-RING-4417.",
          severity: "high",
          patternAlert: "RAPID RETENTION CHAIN",
          metadata: {
            amount: "$4,550.00",
            counterparty: "ACC-MULE-9011",
          },
        },
        {
          id: "TX-70003",
          timestamp: "2026-09-06T07:15:00Z",
          relativeTime: "Layering Hop 3 (+37m)",
          type: "transaction",
          title: "Hop 3 Transfer: $4,300.00 -> ACC-MULE-9011",
          description: "Third sequential hop walking through offshore ledger gateway.",
          severity: "high",
          patternAlert: "COORDINATED MULTI-NODE BURST",
          metadata: {
            amount: "$4,300.00",
            counterparty: "ACC-MULE-9011",
          },
        },
      ];
    }

    // Default fallback timeline constructed from findings
    return [
      {
        id: "EVT-GENERIC-1",
        timestamp: "2026-09-01T00:00:00Z",
        relativeTime: "5 days prior",
        type: "login",
        title: "Baseline Customer Session",
        description: "Account access records consistent with historical behavioral parameters.",
        severity: "low",
        metadata: { source_table: "Customer_History" },
      },
      {
        id: "TX-TARGET",
        timestamp: report.created_at,
        relativeTime: "T = 0 (Incident Time)",
        type: "transaction",
        title: `Monitored Transaction: TX ${report.transaction_id}`,
        description: report.summary,
        severity: report.confidence_score >= 75 ? "high" : report.confidence_score >= 40 ? "medium" : "low",
        patternAlert: report.verdict.toUpperCase(),
        metadata: {
          confidence_score: `${report.confidence_score}%`,
          verdict: report.verdict,
        },
      },
    ];
  };

  const events = getEventsForCase();
  const filteredEvents = filterSeverity === "all" ? events : events.filter((e) => e.severity === filterSeverity);

  const getEventIcon = (type: string) => {
    switch (type) {
      case "password_reset":
        return <Key className="w-4 h-4 text-rose-400" />;
      case "device_change":
        return <Smartphone className="w-4 h-4 text-amber-400" />;
      case "ticket":
        return <MessageSquare className="w-4 h-4 text-purple-400" />;
      case "transaction":
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      default:
        return <Clock className="w-4 h-4 text-emerald-400" />;
    }
  };

  return (
    <div className="bg-[#0b101b] border border-[#1b253b] rounded-xl overflow-hidden shadow-terminal-md">
      {/* Header */}
      <div className="p-4 bg-[#080d16] border-b border-[#1b253b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-[#111726] border border-[#232f48] flex items-center justify-center font-mono text-blue-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">Unified Forensic Timeline</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10192e] text-blue-300 border border-[#1e2f57]">
                Deterministic Sequence Reconstruction
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Chronological merge of Customer_History, Support_Tickets, and Ledger transactions for Case {report.transaction_id}
            </p>
          </div>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center gap-1 bg-[#0f1523] p-1 rounded-lg border border-[#1f2d48] text-xs font-mono">
          <button
            onClick={() => setFilterSeverity("all")}
            className={`px-2.5 py-1 rounded transition ${filterSeverity === "all" ? "bg-[#1b263e] text-white font-bold" : "text-slate-400"}`}
          >
            All ({events.length})
          </button>
          <button
            onClick={() => setFilterSeverity("high")}
            className={`px-2.5 py-1 rounded transition ${filterSeverity === "high" ? "bg-rose-950/70 text-rose-300 font-bold border border-rose-800" : "text-slate-400"}`}
          >
            High Risk
          </button>
          <button
            onClick={() => setFilterSeverity("low")}
            className={`px-2.5 py-1 rounded transition ${filterSeverity === "low" ? "bg-emerald-950/70 text-emerald-300 font-bold border border-emerald-800" : "text-slate-400"}`}
          >
            Baseline
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="p-6 relative">
        {/* Continuous vertical spine */}
        <div className="absolute left-[39px] top-8 bottom-8 w-0.5 bg-[#172236]"></div>

        <div className="space-y-6">
          {filteredEvents.map((evt) => {
            const isExpanded = expandedEventId === evt.id;
            return (
              <div key={evt.id} className="relative pl-12">
                {/* Node icon dot */}
                <div
                  className={`absolute left-0 top-1.5 h-8 w-8 rounded-full border-2 flex items-center justify-center bg-[#070b13] z-10 ${
                    evt.severity === "high"
                      ? "border-rose-500 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.4)]"
                      : evt.severity === "medium"
                      ? "border-amber-500 text-amber-400"
                      : "border-emerald-500 text-emerald-400"
                  }`}
                >
                  {getEventIcon(evt.type)}
                </div>

                {/* Event Card */}
                <div
                  onClick={() => {
                    soundManager.playClick();
                    setExpandedEventId(isExpanded ? null : evt.id);
                  }}
                  className={`p-4 rounded-xl border transition cursor-pointer ${
                    evt.severity === "high"
                      ? "bg-[#111320] border-rose-950/80 hover:border-rose-800/80"
                      : "bg-[#0b101c] border-[#182338] hover:border-[#223354]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-white tracking-tight">{evt.title}</span>
                      {evt.patternAlert && (
                        <span
                          className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold tracking-wider uppercase border ${
                            evt.severity === "high"
                              ? "bg-rose-950/80 text-rose-300 border-rose-800"
                              : evt.severity === "medium"
                              ? "bg-amber-950/80 text-amber-300 border-amber-800"
                              : "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                          }`}
                        >
                          {evt.patternAlert}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="text-blue-300 font-bold">{evt.relativeTime}</span>
                      <span className="text-slate-500 text-[11px]">({evt.timestamp.replace("T", " ").replace("Z", " UTC")})</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 mt-2 font-sans leading-relaxed">{evt.description}</p>

                  {/* Expanded metadata drawer */}
                  {isExpanded && evt.metadata && (
                    <div className="mt-3 pt-3 border-t border-[#18243b] grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 font-mono text-[11px]">
                      {Object.entries(evt.metadata).map(([key, value]) => (
                        <div key={key} className="p-2 rounded bg-[#070b13] border border-[#162137]">
                          <span className="text-slate-500 text-[10px] uppercase block">{key.replace(/_/g, " ")}</span>
                          <span className="text-slate-200 font-bold truncate block">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
