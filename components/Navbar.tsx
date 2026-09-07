"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  LogOut,
  ChevronDown,
  Lock,
  CheckCircle,
  Volume2,
  VolumeX,
  Keyboard,
  Activity,
} from "lucide-react";
import { soundManager } from "@/lib/sound";

export default function Navbar() {
  const { analyst, availableAnalysts, login, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsMuted(soundManager.isMuted());
  }, []);

  const handleToggleSound = () => {
    const muted = soundManager.toggleMute();
    setIsMuted(muted);
  };

  const handleOpenShortcuts = () => {
    soundManager.playClick();
    window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
  };

  return (
    <header className="border-b border-[#1b2336] bg-[#0a0d14]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-3 min-w-0">
          <div className="h-9 w-9 rounded-lg bg-[#111726] border border-[#232f48] shadow-terminal-sm flex items-center justify-center font-mono font-bold text-blue-400 flex-shrink-0 text-sm">
            <ShieldCheck className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">FraudCopilot</span>
              <span className="hidden sm:inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded bg-[#10192e] text-blue-300 border border-[#1e2f57]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                RADAR LIVE
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-slate-400 font-mono truncate">
              The Agentic AI Handbook &bull; Deterministic Guardrails (Ch. 8 & 9)
            </p>
          </div>
        </div>

        {/* Architecture Telemetry Pills (Desktop) */}
        <div className="hidden xl:flex items-center space-x-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded bg-[#0d1322] border border-[#1b2742] text-slate-300 shadow-sm flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            Autonomy: <strong className="text-white">L2 Human-Gated</strong>
          </span>
          <span className="px-2.5 py-1 rounded bg-[#0d1322] border border-[#1b2742] text-slate-300 shadow-sm">
            Pattern: <span className="text-blue-300">Multi-Agent Synthesis</span>
          </span>
          <span className="px-2.5 py-1 rounded bg-[#0d1322] border border-[#1b2742] text-slate-300 shadow-sm flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="text-slate-400">Latency:</span>
            <span className="text-emerald-300 tabular-nums">38ms</span>
          </span>
        </div>

        {/* Interactive Controls & Analyst Session */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Sound Synthesizer Toggle */}
          <button
            onClick={handleToggleSound}
            className={`p-2 rounded-lg border transition shadow-terminal-sm active:scale-[0.95] flex items-center justify-center ${
              isMuted
                ? "bg-[#0c101a] border-[#1a2336] text-slate-500 hover:text-slate-300"
                : "bg-[#101726] border-[#1e2c48] text-blue-300 hover:bg-[#152035]"
            }`}
            title={isMuted ? "Unmute terminal sound effects" : "Mute terminal sound effects"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Keyboard Shortcuts Trigger */}
          <button
            onClick={handleOpenShortcuts}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0e1422] hover:bg-[#141d30] border border-[#1f2a44] text-slate-300 text-xs font-mono transition shadow-terminal-sm active:scale-[0.95]"
            title="View keyboard shortcuts (Press ? anywhere)"
          >
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[11px] font-bold px-1 rounded bg-[#162035] border border-[#233252] text-blue-300">?</span>
          </button>
          {analyst ? (
            <div className="flex items-center gap-2 relative">
              {/* Analyst Profile Pill / Switcher */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg bg-[#0e1422] hover:bg-[#131b2e] border border-[#1f2a44] text-left transition shadow-terminal-sm active:scale-[0.98]"
                title="Switch active investigator profile"
              >
                <div
                  className={`h-7 w-7 rounded-md bg-[#162035] border border-[#2b3a5c] flex items-center justify-center text-xs font-mono font-bold text-blue-300 shadow-inner`}
                >
                  {analyst.initials}
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-100">{analyst.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#101728] text-blue-300 border border-[#202d4b]">
                      {analyst.id}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-none mt-0.5">{analyst.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5" />
              </button>

              {/* Direct Sign Out Button */}
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#111624] hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-[#1e273e] hover:border-rose-800/60 text-xs font-medium transition flex-shrink-0 active:scale-[0.98]"
                title="Sign out of current analyst session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {/* Switch Analyst Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-72 bg-[#0d121e] border border-[#222c42] rounded-xl shadow-2xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2.5 border-b border-[#1b2336] bg-[#090d15]/50">
                    <div className="text-slate-400 text-[10px] uppercase font-mono font-semibold tracking-wider">Active Investigator</div>
                    <div className="font-semibold text-white mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      <span>{analyst.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#141b2c] text-blue-300 border border-[#212e4c]">
                        {analyst.id}
                      </span>
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{analyst.tier}</div>
                  </div>

                  <div className="px-3.5 py-1.5 text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider">
                    Switch Active Analyst
                  </div>
                  {availableAnalysts.map((a) => (
                    <button
                      key={a.id}
                      onClick={async () => {
                        await login({ analystId: a.id });
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-[#141c2e] transition ${
                        a.id === analyst.id ? "bg-[#11192a] text-blue-200 font-semibold" : "text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-[#182238] border border-[#27375a] flex items-center justify-center text-[10px] font-mono font-bold text-blue-300">
                          {a.initials}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-200">{a.name}</div>
                          <div className="text-[10px] text-slate-400">{a.role}</div>
                        </div>
                      </div>
                      {a.id === analyst.id && <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/40 border border-amber-800/50 px-2.5 py-1.5 rounded-lg font-mono">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Unauthenticated</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
