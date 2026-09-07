"use client";

import React from "react";
import { X, Keyboard, Command } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: "J or ↓", desc: "Select next case in queue" },
    { key: "K or ↑", desc: "Select previous case in queue" },
    { key: "/", desc: "Focus instant search & filter" },
    { key: "1", desc: "Quick-select 'Confirm Fraud' decision" },
    { key: "2", desc: "Quick-select 'Clear Suspicion' decision" },
    { key: "3", desc: "Quick-select 'Escalate to SAR' decision" },
    { key: "?", desc: "Toggle this Keyboard Shortcuts HUD" },
    { key: "Esc", desc: "Close modals & clear search focus" },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-[#0e131f] border border-[#22304c] rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-[#1b253b] flex items-center justify-between bg-[#090d15]">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-[#111828] border border-[#213152] flex items-center justify-center text-blue-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono">Terminal Hotkeys HUD</h3>
              <p className="text-[11px] text-slate-400 font-mono">High-speed investigation controls</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg bg-[#131b2c] text-slate-400 hover:text-white border border-[#1f2c46] transition active:scale-[0.95]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="p-4 divide-y divide-[#172236] font-mono text-xs">
          {shortcuts.map((s, i) => (
            <div key={i} className="py-2.5 flex items-center justify-between gap-3">
              <span className="text-slate-300 font-sans text-xs">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-[#131c2e] border border-[#223252] text-blue-300 text-[11px] font-bold shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#1b253b] bg-[#090d15] text-center text-[11px] font-mono text-slate-500">
          Press <kbd className="px-1.5 py-0.5 rounded bg-[#121929] border border-[#1c273e] text-slate-300">Esc</kbd> anytime to dismiss
        </div>
      </div>
    </div>
  );
}
