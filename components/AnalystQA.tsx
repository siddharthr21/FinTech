"use client";

import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, MessageSquare, Bot, User, ShieldAlert, CheckCircle, HelpCircle, Loader2 } from "lucide-react";
import { soundManager } from "@/lib/sound";
import { InvestigationReport } from "@/lib/types";

interface AnalystQAProps {
  report: InvestigationReport;
  onSelectEvidence?: (evidenceId: string) => void;
}

interface ChatMessage {
  id: string;
  sender: "analyst" | "assistant";
  text: string;
  evidenceIds?: string[];
  timestamp: string;
  isLlm?: boolean;
}

const QUICK_QUESTIONS = [
  "Why is this case high risk?",
  "What changed immediately before the transaction?",
  "What evidence suggests this could be legitimate?",
  "Which other accounts or devices are connected?",
];

export default function AnalystQA({ report, onSelectEvidence }: AnalystQAProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [llmStatus, setLlmStatus] = useState<{ configured: boolean; model?: string }>({ configured: false });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check LLM status on mount
  useEffect(() => {
    fetch("/api/config/llm-status")
      .then((res) => res.json())
      .then((data) => {
        setLlmStatus(data);
      })
      .catch(() => {
        setLlmStatus({ configured: false });
      });
  }, []);

  // Initial welcome message when switching reports
  useEffect(() => {
    const welcomeMessage: ChatMessage = {
      id: "welcome",
      sender: "assistant",
      text: `Hello, Investigator. I am your Evidence Copilot for case **${report.transaction_id}** (${report.verdict} - ${report.confidence_score}% Confidence).\n\nYou can ask any question about the anomalies, customer history, fraud ring connections, or contradictory evidence. All answers are strictly grounded in this case's structured evidence.`,
      evidenceIds: (report.evidence_trail || []).slice(0, 3).map((e) => e.evidence_id!).filter(Boolean),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages([welcomeMessage]);
  }, [report.report_id, report.transaction_id, report.verdict, report.confidence_score, report.evidence_trail]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (questionText?: string) => {
    const q = (questionText || inputValue).trim();
    if (!q || isLoading) return;

    soundManager.playClick();
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: "analyst",
      text: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/reports/${encodeURIComponent(report.report_id)}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });

      const data = await res.json();
      if (res.ok) {
        soundManager.playSuccessChime();
        const assistantMsg: ChatMessage = {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: data.answer,
          evidenceIds: data.evidence_ids || [],
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isLlm: data.is_llm,
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        soundManager.playAlertBuzz();
        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: "assistant",
          text: `⚠️ Query Error: ${data.error || "Unable to answer question."}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
    } catch (err: any) {
      soundManager.playAlertBuzz();
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        sender: "assistant",
        text: `⚠️ Network error: ${err.message || "Failed to reach investigation endpoint."}`,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#090d15] border border-[#1b253b] rounded-xl overflow-hidden shadow-terminal-sm flex flex-col h-[580px]">
      {/* Header bar */}
      <div className="px-4 py-3 bg-[#0c121e] border-b border-[#182338] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-[#141f36] border border-[#23355b] text-blue-300 flex items-center justify-center font-mono">
            <MessageSquare className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                Analyst Evidence Assistant
              </h4>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950/70 text-blue-300 border border-blue-800 font-mono">
                Spec §7 Grounded Q&amp;A
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Natural-language interrogation with verifiable audit evidence citations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {llmStatus.configured ? (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live LLM ({llmStatus.model || "Active"})
            </span>
          ) : (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Grounded Engine (Local)
            </span>
          )}
        </div>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 overflow-y-auto space-y-3.5 font-mono text-xs">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 ${m.sender === "analyst" ? "justify-end" : "justify-start"}`}
          >
            {m.sender === "assistant" && (
              <div className="w-7 h-7 rounded-lg bg-[#141d33] border border-[#22335a] text-cyan-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[82%] rounded-xl p-3.5 space-y-2 border ${
                m.sender === "analyst"
                  ? "bg-[#18233a] border-blue-600/60 text-blue-100"
                  : "bg-[#0d1424] border-[#1f2e4d] text-slate-200"
              }`}
            >
              <div className="flex items-center justify-between gap-4 text-[10px] text-slate-400 border-b border-slate-700/40 pb-1">
                <span className="font-semibold text-slate-300 uppercase">
                  {m.sender === "analyst" ? "Analyst" : "Evidence Copilot"}
                </span>
                <span>{m.timestamp}</span>
              </div>

              {/* Message text with basic markdown formatting */}
              <div className="text-[11px] leading-relaxed whitespace-pre-wrap font-sans text-slate-200">
                {m.text}
              </div>

              {/* Evidence citations chips */}
              {m.evidenceIds && m.evidenceIds.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5 items-center">
                  <span className="text-[9px] text-slate-500 font-mono uppercase">Cited Evidence:</span>
                  {m.evidenceIds.map((evId, idx) => (
                    <button
                      key={idx}
                      onClick={() => onSelectEvidence && onSelectEvidence(evId)}
                      className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#101b30] hover:bg-[#1a2d52] text-cyan-300 border border-cyan-800/80 transition active:scale-95"
                    >
                      {evId}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {m.sender === "analyst" && (
              <div className="w-7 h-7 rounded-lg bg-[#1a2744] border border-[#2b4170] text-blue-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 justify-start items-center">
            <div className="w-7 h-7 rounded-lg bg-[#141d33] border border-[#22335a] text-cyan-300 flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-3 rounded-xl bg-[#0d1424] border border-[#1f2e4d] flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span className="text-xs font-mono">Synthesizing evidence-grounded response...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Quick Questions */}
      <div className="px-3 py-2 bg-[#0a0f1a] border-t border-[#162033] flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <span className="text-[10px] font-mono text-slate-500 uppercase flex-shrink-0 flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" /> Quick:
        </span>
        {QUICK_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            disabled={isLoading}
            onClick={() => handleSend(q)}
            className="text-[10px] font-mono px-2 py-1 rounded bg-[#101726] hover:bg-[#17233a] text-slate-300 hover:text-white border border-[#1e2e4a] whitespace-nowrap transition active:scale-95 disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <div className="p-3 bg-[#0c121e] border-t border-[#182338]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            id="analyst-question"
            name="analyst-question"
            aria-label={`Ask Evidence Copilot about TX ${report.transaction_id}`}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Ask about TX ${report.transaction_id} (e.g. why high risk, contradicting evidence, ring links)...`}
            disabled={isLoading}
            className="flex-1 bg-[#070a12] border border-[#1c2944] rounded-lg px-3 py-2 text-xs font-mono text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
