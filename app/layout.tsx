import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FraudCopilot | Multi-Agent Fraud Investigation Copilot",
  description: "Ground-truth multi-agent fraud investigation copilot adhering to The Agentic AI Handbook (Comed Kares / ERA Foundation, 2026).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#0b0f19] text-slate-100 antialiased min-h-screen flex flex-col">
        {/* Navigation Header */}
        <header className="border-b border-slate-800 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
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

            {/* Architecture Badges */}
            <div className="hidden lg:flex items-center space-x-2 text-xs">
              <span className="px-2.5 py-1 rounded bg-blue-950/70 border border-blue-800/60 text-blue-300 font-mono">
                Autonomy: L2 Human-Gated (Ch.1)
              </span>
              <span className="px-2.5 py-1 rounded bg-purple-950/70 border border-purple-800/60 text-purple-300 font-mono">
                Pattern: Multi-Agent Orchestration (Ch.3.3)
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 font-mono">
                Oversight: 5-Layer Defense (Ch.9)
              </span>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500 bg-[#0a0e1a]">
          Multi-Agent Fraud Investigation Copilot MVP &bull; Stack: Make.com + Airtable + Vercel &bull; Deterministic Action Guardrails
        </footer>
      </body>
    </html>
  );
}
