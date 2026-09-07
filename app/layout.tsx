import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "FraudCopilot | Multi-Agent Fraud Investigation Copilot",
  description: "Enterprise multi-agent fraud investigation copilot with deterministic safety guardrails and evidence-grounded reasoning.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#080b11] text-slate-100 antialiased min-h-screen flex flex-col selection:bg-blue-600/30 selection:text-white">
        <AuthProvider>
          <div className="terminal-ambient-glow min-h-screen flex flex-col">
            <Navbar />
            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto px-3 py-4 sm:px-6 lg:px-8 overflow-x-hidden">
              {children}
            </main>

            {/* Terminal Footer */}
            <footer className="border-t border-[#1a2234] py-4 text-center text-xs text-slate-500 bg-[#07090e]">
              <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-slate-500">
                  FraudCopilot Operations Cockpit &bull; Deterministic Multi-Agent System
                </span>
                <span className="font-mono text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  Human Checkpoint Active &bull; Tier 1–3 Enforced
                </span>
              </div>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
