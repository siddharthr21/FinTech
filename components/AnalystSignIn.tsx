"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ShieldAlert,
  Lock,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  UserCheck,
} from "lucide-react";

export default function AnalystSignIn() {
  const { availableAnalysts, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [customLoading, setCustomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleQuickLogin = async (analystId: string) => {
    setError(null);
    setLoadingId(analystId);
    try {
      const result = await login({ analystId });
      if (!result.success) {
        setError(result.error || "Failed to sign in.");
      }
    } finally {
      setLoadingId(null);
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your analyst email.");
      return;
    }
    setError(null);
    setCustomLoading(true);
    try {
      const result = await login({ email, password });
      if (!result.success) {
        setError(result.error || "Invalid analyst credentials.");
      }
    } finally {
      setCustomLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Oversight Architecture Banner */}
      <div className="bg-[#111827] border-2 border-indigo-900/60 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-950 border border-indigo-700 text-indigo-400 flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-950/50">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">Analyst Authentication Gateway</h2>
              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                Oversight Layer 1 & 3
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Grounded in <strong>The Agentic AI Handbook (Ch.9.1 &amp; Ch.9.3)</strong>: All consequential case
              determinations (Approve Fraud, False Positive, Escalate) require explicit human sign-off by a certified
              fraud analyst. Closed cases permanently record analyst attribution in the audit trail.
            </p>
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-lg bg-rose-950/70 border border-rose-800 text-xs text-rose-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Quick-Select Certified Analyst Roster */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              Certified Analyst Directory &bull; Instant Demo Access
            </span>
            <span className="text-[11px] text-slate-500">Select an analyst profile to sign in</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {availableAnalysts.map((a) => {
              const isLoading = loadingId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => handleQuickLogin(a.id)}
                  disabled={isLoading || customLoading}
                  className="p-4 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-indigo-500/80 text-left transition flex flex-col justify-between space-y-3 group disabled:opacity-50"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div
                        className={`h-8 w-8 rounded-lg bg-gradient-to-br ${a.badgeColor || "from-indigo-600 to-indigo-800"} flex items-center justify-center text-xs font-bold text-white shadow`}
                      >
                        {a.initials}
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {a.id}
                      </span>
                    </div>
                    <div className="font-bold text-sm text-white group-hover:text-indigo-300 transition">
                      {a.name}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-snug">{a.role}</div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 font-mono">{a.tier.split(" ")[0]}</span>
                    <span className="text-indigo-400 font-medium flex items-center gap-1 group-hover:translate-x-0.5 transition">
                      {isLoading ? "Signing in..." : "Sign In"}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Manual Credentials Form */}
        <div className="pt-4 border-t border-slate-800">
          <details className="group">
            <summary className="text-xs text-slate-400 hover:text-slate-200 cursor-pointer font-medium flex items-center gap-1.5 select-none">
              <KeyRound className="w-3.5 h-3.5" />
              <span>Or sign in with custom credentials / password</span>
            </summary>

            <form onSubmit={handleCustomLogin} className="mt-3 space-y-3 max-w-md">
              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">Analyst Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. sarah.chen@fraudcopilot.internal"
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 font-medium mb-1">
                  Passcode / Token <span className="text-slate-500 font-normal">(demo: investigator2026)</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="investigator2026"
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <button
                type="submit"
                disabled={customLoading}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                {customLoading ? "Verifying..." : "Authenticate Session"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </details>
        </div>
      </div>
    </div>
  );
}
