"use client";

import React, { useState } from "react";
import { RingAnalysisResult, RingFinding, NetworkGraphNode, NetworkGraphEdge } from "@/lib/types";
import {
  ShieldAlert,
  ShieldCheck,
  Share2,
  Cpu,
  Globe,
  ArrowRight,
  Layers,
  AlertTriangle,
  User,
  Smartphone,
  ExternalLink,
  Info,
} from "lucide-react";
import { soundManager } from "@/lib/sound";

interface NetworkRingGraphProps {
  ringAnalysis?: RingAnalysisResult | null;
  ringScore?: number | null;
  transactionId?: string;
}

export default function NetworkRingGraph({
  ringAnalysis: propAnalysis,
  ringScore: propScore,
  transactionId = "TX-LIVE",
}: NetworkRingGraphProps) {
  const [selectedNode, setSelectedNode] = useState<NetworkGraphNode | null>(null);
  const [activeTab, setActiveTab] = useState<"graph" | "table" | "signals">("graph");

  let ringAnalysis: RingAnalysisResult | null = null;
  if (propAnalysis) {
    if (typeof propAnalysis === "string") {
      try {
        ringAnalysis = JSON.parse(propAnalysis);
      } catch (e) {
        ringAnalysis = null;
      }
    } else {
      ringAnalysis = propAnalysis;
    }
  }

  const ringScore = ringAnalysis ? ringAnalysis.ring_score : (propScore ?? 0);
  const isSuspicious = ringAnalysis?.is_suspicious_ring ?? (ringScore >= 50);

  if (!ringAnalysis) {
    return (
      <div className="bg-[#0b101b] border border-[#1b253b] rounded-xl p-8 text-center text-slate-400">
        <div className="h-12 w-12 rounded-xl bg-[#111828] border border-[#1e2c48] flex items-center justify-center mx-auto mb-3 text-slate-500">
          <Share2 className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-200 font-mono">Zero Network Overlap Detected</h4>
        <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 font-mono">
          This transaction originates from an isolated device and IP with zero hardware or counterparty linkage to other customer accounts.
        </p>
      </div>
    );
  }

  const nodes = ringAnalysis.graph?.nodes || [];
  const edges = ringAnalysis.graph?.edges || [];
  const findings = ringAnalysis.findings || [];
  const entities = ringAnalysis.entities || { customers: [], devices: [], ips: [], counterparty_accounts: [] };

  // Calculate coordinates for circular layout in SVG viewBox 600x380
  const centerX = 300;
  const centerY = 190;
  const radius = 135;

  const nodePositions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node, i) => {
    const angle = (i / Math.max(1, nodes.length)) * 2 * Math.PI - Math.PI / 2;
    nodePositions[node.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  const getNodeColor = (node: NetworkGraphNode) => {
    if (node.type === "customer") return node.isFlagged ? "#f43f5e" : "#38bdf8"; // rose vs sky
    if (node.type === "device") return "#a855f7"; // purple
    if (node.type === "ip") return "#06b6d4"; // cyan
    return "#f59e0b"; // amber for mule accounts
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case "customer":
        return <User className="w-3.5 h-3.5" />;
      case "device":
        return <Smartphone className="w-3.5 h-3.5" />;
      case "ip":
        return <Globe className="w-3.5 h-3.5" />;
      default:
        return <ExternalLink className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="bg-[#0b101b] border border-[#1b253b] rounded-xl overflow-hidden shadow-terminal-md">
      {/* Header Banner */}
      <div className="p-4 bg-[#080d16] border-b border-[#1b253b] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-9 w-9 rounded-lg border flex items-center justify-center font-mono font-bold text-sm ${
              isSuspicious
                ? "bg-rose-950/50 border-rose-800 text-rose-300"
                : ringScore >= 35
                ? "bg-amber-950/50 border-amber-800 text-amber-300"
                : "bg-emerald-950/50 border-emerald-800 text-emerald-300"
            }`}
          >
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white font-mono">
                {isSuspicious ? "CRITICAL FRAUD RING SYNDICATE" : "Forensic Network Topology"}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold uppercase ${
                  isSuspicious
                    ? "bg-rose-950/60 text-rose-300 border-rose-800"
                    : ringScore >= 35
                    ? "bg-amber-950/60 text-amber-300 border-amber-800"
                    : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
                }`}
              >
                Score: {ringScore}%
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Cluster ID: <span className="text-blue-300 font-semibold">{ringAnalysis.cluster_id}</span> &bull; {entities.customers.length} Accounts &bull; {entities.devices.length} Devices &bull; {entities.ips.length} IPs
            </p>
          </div>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-1 bg-[#0f1523] p-1 rounded-lg border border-[#1f2d48]">
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab("graph");
            }}
            className={`px-3 py-1 text-xs font-mono rounded-md transition ${
              activeTab === "graph" ? "bg-[#1b263e] text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            SVG Graph
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab("table");
            }}
            className={`px-3 py-1 text-xs font-mono rounded-md transition ${
              activeTab === "table" ? "bg-[#1b263e] text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Entity Table
          </button>
          <button
            onClick={() => {
              soundManager.playClick();
              setActiveTab("signals");
            }}
            className={`px-3 py-1 text-xs font-mono rounded-md transition ${
              activeTab === "signals" ? "bg-[#1b263e] text-white font-bold" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Signals ({findings.length})
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === "graph" && (
        <div className="p-4 flex flex-col xl:flex-row gap-4 items-center justify-between">
          {/* Visual SVG Network */}
          <div className="relative w-full xl:w-2/3 bg-[#070a12] border border-[#172033] rounded-xl overflow-hidden flex items-center justify-center p-2">
            <svg viewBox="0 0 600 380" className="w-full h-auto max-h-[380px] select-none">
              <defs>
                <filter id="glow-red" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(244, 63, 94, 0.6)" />
                </filter>
                <filter id="glow-purple" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(168, 85, 247, 0.6)" />
                </filter>
                <filter id="glow-amber" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="rgba(245, 158, 11, 0.6)" />
                </filter>
              </defs>

              {/* Background circular guides */}
              <circle cx={centerX} cy={centerY} r={radius} fill="none" stroke="#131c2e" strokeDasharray="3 3" strokeWidth="1" />
              <circle cx={centerX} cy={centerY} r={radius * 0.5} fill="none" stroke="#101726" strokeDasharray="2 2" strokeWidth="1" />

              {/* Edges */}
              {edges.map((edge, i) => {
                const p1 = nodePositions[edge.source];
                const p2 = nodePositions[edge.target];
                if (!p1 || !p2) return null;
                return (
                  <g key={`edge-${i}`}>
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={edge.relationship === "TRANSFERRED_TO" ? "#f59e0b" : "#223252"}
                      strokeWidth={edge.relationship === "TRANSFERRED_TO" ? 2 : 1.2}
                      strokeDasharray={edge.relationship === "TRANSFERRED_TO" ? "4 2" : undefined}
                      opacity={0.8}
                    />
                  </g>
                );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                const pos = nodePositions[node.id];
                if (!pos) return null;
                const isSelected = selectedNode?.id === node.id;
                const color = getNodeColor(node);
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer transition-transform duration-150 hover:scale-110"
                    onClick={() => {
                      soundManager.playClick();
                      setSelectedNode(node);
                    }}
                  >
                    <circle
                      r={node.type === "customer" ? 18 : 14}
                      fill="#0b101c"
                      stroke={color}
                      strokeWidth={isSelected ? 3 : 2}
                      filter={node.isFlagged ? "url(#glow-red)" : undefined}
                    />
                    <text
                      y={4}
                      textAnchor="middle"
                      fill={color}
                      fontSize="9"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {node.type === "customer"
                        ? node.id.replace("CUST-", "")
                        : node.type === "device"
                        ? "DEV"
                        : node.type === "ip"
                        ? "IP"
                        : "ACC"}
                    </text>
                    <text
                      y={26}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="8"
                      fontFamily="monospace"
                      className="select-none pointer-events-none"
                    >
                      {node.label.length > 12 ? `${node.label.substring(0, 10)}...` : node.label}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Legend overlay */}
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 text-[10px] font-mono bg-[#0b101b]/90 border border-[#1b253b] px-2.5 py-1.5 rounded-lg">
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span> Flagged Customer
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span> Shared Device
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-cyan-500"></span> Shared Gateway
              </span>
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span> Mule Account
              </span>
            </div>
          </div>

          {/* Node Inspector / Cluster Summary Card */}
          <div className="w-full xl:w-1/3 bg-[#080d16] border border-[#172237] rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#172237]">
                <span className="text-xs font-mono font-bold text-slate-200">
                  {selectedNode ? "Entity Inspector" : "Cluster Intelligence"}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101828] text-blue-300 border border-[#1d2b48]">
                  {selectedNode ? selectedNode.type.toUpperCase() : "SYNDICATE VIEW"}
                </span>
              </div>

              {selectedNode ? (
                <div className="mt-3 space-y-2.5 font-mono text-xs">
                  <div>
                    <span className="text-slate-500 text-[11px] block">Identifier</span>
                    <span className="text-white font-bold">{selectedNode.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Label / Identity</span>
                    <span className="text-blue-300">{selectedNode.label}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[11px] block">Network Status</span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mt-0.5 ${
                        selectedNode.isFlagged
                          ? "bg-rose-950/60 text-rose-300 border border-rose-800"
                          : "bg-slate-800 text-slate-300"
                      }`}
                    >
                      {selectedNode.isFlagged ? "High-Risk Overlap" : "Neutral Gateway"}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedNode(null)}
                    className="w-full mt-2 py-1.5 rounded bg-[#121929] hover:bg-[#18233a] border border-[#202f4d] text-slate-300 text-[11px] transition"
                  >
                    View Cluster Overview
                  </button>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <p className="text-xs font-mono text-slate-300 leading-relaxed">
                    {ringAnalysis.summary}
                  </p>
                  <div className="p-2.5 rounded-lg bg-[#0e1422] border border-[#1b2740] space-y-1.5 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Total Layering Hops:</span>
                      <span className="text-amber-400 font-bold">
                        {findings.find((f) => f.signal_type === "transfer_chain")?.evidence?.hop_count || 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Mule Concentration:</span>
                      <span className="text-rose-400 font-bold">
                        {findings.find((f) => f.signal_type === "fan_in_out")?.evidence?.max_degree || 0} source accounts
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Hardware Overlap:</span>
                      <span className="text-purple-400 font-bold">
                        {entities.devices.join(", ") || "None"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-[#172237] flex items-center justify-between text-[11px] font-mono text-slate-400">
              <span>Deterministic Safety Guardrail</span>
              <span className="text-emerald-400 font-bold">✓ Pure Python Zero-LLM</span>
            </div>
          </div>
        </div>
      )}

      {/* Table view */}
      {activeTab === "table" && (
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="border-b border-[#1c273e] text-slate-400 text-[11px] bg-[#070b12]">
                <th className="py-2.5 px-3">Entity Type</th>
                <th className="py-2.5 px-3">Identifier</th>
                <th className="py-2.5 px-3">Associated Links</th>
                <th className="py-2.5 px-3">Risk Assessment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#141d2e]">
              {nodes.map((n, idx) => (
                <tr key={idx} className="hover:bg-[#0e1524] transition">
                  <td className="py-2.5 px-3 flex items-center gap-1.5 text-slate-300 capitalize">
                    {getNodeIcon(n.type)}
                    <span>{n.type}</span>
                  </td>
                  <td className="py-2.5 px-3 text-white font-bold">{n.id}</td>
                  <td className="py-2.5 px-3 text-slate-300">{n.label}</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        n.isFlagged
                          ? "bg-rose-950/60 text-rose-300 border-rose-800"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      {n.isFlagged ? "Suspicious Node" : "Standard Node"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Signals breakdown view */}
      {activeTab === "signals" && (
        <div className="p-4 space-y-2.5">
          {findings.map((f, i) => (
            <div
              key={i}
              className="p-3 rounded-lg bg-[#0e1422] border border-[#1b2740] flex items-start justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white uppercase tracking-wider">
                    {f.signal_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-rose-950/60 text-rose-300 border border-rose-800">
                    Severity: {f.severity}/100
                  </span>
                </div>
                <p className="text-xs text-slate-300 font-sans">{f.explanation}</p>
                <div className="text-[11px] font-mono text-slate-500">
                  Entities: {f.entities.join(", ")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
