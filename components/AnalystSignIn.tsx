"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Lock,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  UserCheck,
  CheckCircle2,
} from "lucide-react";

interface AnalystSignInProps {
  onBrowseGuest?: () => void;
}

export default function AnalystSignIn({ onBrowseGuest }: AnalystSignInProps) {
  const { availableAnalysts, login } = useAuth();
  const [email, setEmail] = useState("sarah.chen@fraudcopilot.internal");
  const [password, setPassword] = useState("investigator2026");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoadingId, setQuickLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError("Please enter your analyst email address.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await login({ email: email.trim(), password });
      if (!res.success) {
        setError(res.error || "Invalid credentials. Please verify your email and password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = async (analystId: string) => {
    setError(null);
    setQuickLoadingId(analystId);
    try {
      const res = await login({ analystId });
      if (!res.success) {
        setError(res.error || "Failed to sign in.");
      }
    } finally {
      setQuickLoadingId(null);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-10 px-4">
      <div className="max-w-md w-full space-y-6">
        {/* Brand / Logo Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-rose-500 items-center justify-center font-bold text-white text-xl shadow-xl shadow-indigo-500/25 mb-1">
            FC
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Analyst Sign In
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            FraudCopilot Multi-Agent Investigation Operations Portal &bull; Human Checkpoint Access
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/80 border border-rose-800 text-xs text-rose-200 flex items-center gap-2.5 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Analyst Work Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@fraudcopilot.internal"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#0a0e1a] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Passcode / Password
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Default: <span className="text-indigo-300">investigator2026</span>
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-[#0a0e1a] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition font-sans"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || quickLoadingId !== null}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/40 transition active:scale-[0.99]"
            >
              {loading ? (
                <span>Authenticating Session...</span>
              ) : (
                <>
                  <span>Sign In as Certified Analyst</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-[#111827] px-3 text-[11px] uppercase font-semibold text-slate-500 tracking-wider">
              Or 1-Click Demo Login
            </span>
          </div>

          {/* Quick 1-Click Analyst Buttons */}
          <div className="space-y-2">
            <div className="text-[11px] text-slate-400 text-center">
              Select an authorized investigator profile to sign in instantly:
            </div>
            <div className="space-y-2">
              {availableAnalysts.map((a) => {
                const isThisLoading = quickLoadingId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => handleQuickSelect(a.id)}
                    disabled={loading || quickLoadingId !== null}
                    className="w-full p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800/90 border border-slate-700/80 hover:border-indigo-500/80 text-left transition flex items-center justify-between group disabled:opacity-50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-lg bg-gradient-to-br ${a.badgeColor || "from-indigo-600 to-indigo-800"} flex items-center justify-center text-xs font-bold text-white flex-shrink-0 shadow`}
                      >
                        {a.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white group-hover:text-indigo-300 transition truncate">
                            {a.name}
                          </span>
                          <span className="text-[10px] font-mono px-1 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {a.id}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{a.role}</div>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 pl-2">
                      <span className="text-[10px] text-indigo-400 group-hover:underline flex items-center gap-1 font-medium">
                        {isThisLoading ? "Signing in..." : "1-Click"}
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Read-only Guest Access link */}
          {onBrowseGuest && (
            <div className="pt-2 text-center border-t border-slate-800/80">
              <button
                type="button"
                onClick={onBrowseGuest}
                className="text-xs text-slate-400 hover:text-indigo-300 transition inline-flex items-center gap-1"
              >
                <span>Or explore queue in Read-Only Mode &rarr;</span>
              </button>
            </div>
          )}
        </div>

        {/* Security / Compliance Footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1">
          <div className="flex items-center justify-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>The Agentic AI Handbook &bull; Layer 1 &amp; Layer 3 Defense-in-Depth</span>
          </div>
          <p>
            All case approvals, false-positive dismissals, and escalations are cryptographically tied to the logged-in analyst.
          </p>
        </div>
      </div>
    </div>
  );
}
