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
          <div className="inline-flex h-12 w-12 rounded-xl bg-[#0e131f] border border-[#232f48] shadow-terminal items-center justify-center font-mono font-bold text-blue-400 text-lg mb-1">
            <ShieldCheck className="w-6 h-6 text-blue-400" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Investigator Access Gateway
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto font-mono">
            FraudCopilot Security Perimeter &bull; Certified Human Checkpoint
          </p>
        </div>

        {/* Main Login Card */}
        <div className="bg-[#0e131f] border border-[#1d2538] rounded-2xl p-6 sm:p-7 shadow-terminal space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800/80 text-xs text-rose-200 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Email & Password Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-mono font-medium text-slate-300 mb-1.5">
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
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#090d15] border border-[#1c2538] rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-sans"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono font-medium text-slate-300">
                  Passcode / Token
                </label>
                <span className="text-[10px] text-slate-500 font-mono">
                  Default: <span className="text-blue-300 font-mono">investigator2026</span>
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
                  className="w-full pl-10 pr-10 py-2.5 bg-[#090d15] border border-[#1c2538] rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition font-mono"
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
              className="w-full mt-2 py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition active:scale-[0.98]"
            >
              {loading ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <span>Sign In as Certified Investigator</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-[#1b2336] w-full" />
            <span className="bg-[#0e131f] px-3 text-[10px] uppercase font-mono font-semibold text-slate-500 tracking-wider">
              1-Click Certified Profiles
            </span>
          </div>

          {/* Quick 1-Click Analyst Buttons */}
          <div className="space-y-2">
            {availableAnalysts.map((a) => {
              const isThisLoading = quickLoadingId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => handleQuickSelect(a.id)}
                  disabled={loading || quickLoadingId !== null}
                  className="w-full p-2.5 rounded-lg bg-[#090d15] hover:bg-[#111726] border border-[#1b253a] hover:border-blue-500/60 text-left transition flex items-center justify-between group disabled:opacity-50 active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-md bg-[#141d2f] border border-[#233252] flex items-center justify-center text-xs font-mono font-bold text-blue-300 flex-shrink-0">
                      {a.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs text-white group-hover:text-blue-300 transition truncate">
                          {a.name}
                        </span>
                        <span className="text-[10px] font-mono px-1 rounded bg-[#101726] text-slate-400 border border-[#1c273e]">
                          {a.id}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono truncate">{a.role}</div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 pl-2">
                    <span className="text-[10px] text-blue-400 group-hover:text-blue-300 flex items-center gap-1 font-mono font-medium">
                      {isThisLoading ? "Authorizing..." : "Quick Access"}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Read-only Guest Access link */}
          {onBrowseGuest && (
            <div className="pt-2 text-center border-t border-[#1a2235]">
              <button
                type="button"
                onClick={onBrowseGuest}
                className="text-xs text-slate-400 hover:text-blue-300 transition inline-flex items-center gap-1 font-mono"
              >
                <span>Or explore queue in Read-Only Preview Mode &rarr;</span>
              </button>
            </div>
          )}
        </div>

        {/* Security / Compliance Footnote */}
        <div className="text-center text-[11px] text-slate-500 space-y-1 font-mono">
          <div className="flex items-center justify-center gap-1.5 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Role-Based Access Control &bull; Scoped Analyst Authorization</span>
          </div>
          <p className="text-[10px] text-slate-500">
            All case approvals, false-positive dismissals, and SAR escalations are cryptographically signed.
          </p>
        </div>
      </div>
    </div>
  );
}
