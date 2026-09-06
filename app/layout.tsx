import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";

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
        <AuthProvider>
          <Navbar />
          {/* Main Content Area */}
          <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500 bg-[#0a0e1a]">
            Multi-Agent Fraud Investigation Copilot MVP &bull; Stack: Make.com + Airtable + Vercel &bull; Deterministic Action Guardrails
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
