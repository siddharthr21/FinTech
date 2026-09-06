"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldCheck,
  LogOut,
  LogIn,
  ChevronDown,
  Lock,
  UserCheck,
  CheckCircle,
} from "lucide-react";

export default function Navbar() {
  const { analyst, availableAnalysts, login, logout } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-rose-500 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
            FC
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
              FraudCopilot
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 font-medium">
                Multi-Agent Orchestrator
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Grounded in The Agentic AI Handbook (ERA Foundation / Comed Kares, 2026)
            </p>
          </div>
        </div>

        {/* Architecture Badges (Desktop) */}
        <div className="hidden xl:flex items-center space-x-2 text-xs">
          <span className="px-2.5 py-1 rounded bg-blue-950/70 border border-blue-800/60 text-blue-300 font-mono">
            Autonomy: L2 Human-Gated
          </span>
          <span className="px-2.5 py-1 rounded bg-purple-950/70 border border-purple-800/60 text-purple-300 font-mono">
            Pattern: Multi-Agent (Ch.3.3)
          </span>
          <span className="px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
            Oversight: 5-Layer Defense
          </span>
        </div>

        {/* Analyst Session Controls */}
        <div className="flex items-center gap-3">
          {analyst ? (
            <div className="flex items-center gap-2 relative">
              {/* Analyst Profile Pill / Switcher */}
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 p-1.5 pr-2.5 rounded-lg bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-left transition shadow-sm"
                title="Click to switch analyst"
              >
                <div
                  className={`h-7 w-7 rounded-full bg-gradient-to-br ${analyst.badgeColor || "from-indigo-600 to-indigo-800"} flex items-center justify-center text-xs font-bold text-white shadow`}
                >
                  {analyst.initials}
                </div>
                <div className="hidden sm:block">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white">{analyst.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                      {analyst.id}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-none mt-0.5">{analyst.role}</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-1" />
              </button>

              {/* Direct, Unmistakable Sign Out Button */}
              <button
                onClick={() => logout()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-800/80 text-xs font-medium transition"
                title="Sign out of current analyst session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>

              {/* Switch Analyst Dropdown */}
              {dropdownOpen && (
                <div className="absolute right-0 top-12 w-64 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl py-2 z-50 text-xs animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-800">
                    <div className="text-slate-400 text-[10px] uppercase font-semibold">Active Session</div>
                    <div className="font-bold text-white mt-0.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      {analyst.name}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">{analyst.tier}</div>
                  </div>

                  <div className="px-3.5 py-1.5 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Switch Active Analyst
                  </div>
                  {availableAnalysts.map((a) => (
                    <button
                      key={a.id}
                      onClick={async () => {
                        await login({ analystId: a.id });
                        setDropdownOpen(false);
                      }}
                      className={`w-full px-3.5 py-2 text-left flex items-center justify-between hover:bg-slate-800/80 transition ${
                        a.id === analyst.id ? "bg-indigo-950/40 text-indigo-200 font-semibold" : "text-slate-300"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold">
                          {a.initials}
                        </div>
                        <div>
                          <div className="text-xs">{a.name}</div>
                          <div className="text-[10px] text-slate-400">{a.role}</div>
                        </div>
                      </div>
                      {a.id === analyst.id && <CheckCircle className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-amber-300 bg-amber-950/50 border border-amber-800/60 px-2.5 py-1.5 rounded-lg font-medium">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Not Signed In</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
