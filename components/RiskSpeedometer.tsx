"use client";

import React from "react";

interface RiskSpeedometerProps {
  score: number;
  size?: number;
}

export default function RiskSpeedometer({ score, size = 150 }: RiskSpeedometerProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = 52;
  const circumference = Math.PI * radius; // Semi-circle arc length ~ 163.36
  const progress = clamped / 100;
  const strokeDashoffset = circumference * (1 - progress);

  let strokeColor = "#10b981"; // Emerald
  let glowColor = "rgba(16, 185, 129, 0.5)";
  let badgeText = "LOW RISK";

  if (clamped >= 75) {
    strokeColor = "#ef4444"; // Rose/Crimson
    glowColor = "rgba(239, 68, 68, 0.5)";
    badgeText = "CRITICAL FRAUD";
  } else if (clamped >= 40) {
    strokeColor = "#f59e0b"; // Amber
    glowColor = "rgba(245, 158, 11, 0.5)";
    badgeText = "ELEVATED RISK";
  }

  // Needle angle: -90deg (0) to +90deg (100)
  const needleAngle = -90 + progress * 180;

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      <svg
        width={size}
        height={size * 0.62}
        viewBox="0 0 160 100"
        className="overflow-visible filter drop-shadow-sm"
      >
        <defs>
          <linearGradient id="meterGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="45%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#ef4444" />
          </linearGradient>
          <filter id="meterGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="3.5" floodColor={glowColor} />
          </filter>
        </defs>

        {/* Outer Background Track */}
        <path
          d="M 22 86 A 52 52 0 0 1 138 86"
          fill="none"
          stroke="#131b2c"
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Active Arc */}
        <path
          d="M 22 86 A 52 52 0 0 1 138 86"
          fill="none"
          stroke={strokeColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          filter="url(#meterGlow)"
          className="transition-all duration-700 ease-out"
        />

        {/* Needle Axis Pivot Ring */}
        <circle cx="80" cy="86" r="6" fill="#0b101a" stroke="#253554" strokeWidth="2" />
        <circle cx="80" cy="86" r="2.5" fill="#e2e8f0" />

        {/* Needle Line */}
        <g
          transform={`rotate(${needleAngle}, 80, 86)`}
          className="transition-transform duration-700 ease-out origin-[80px_86px]"
        >
          <line
            x1="80"
            y1="86"
            x2="80"
            y2="42"
            stroke="#f8fafc"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="80" cy="40" r="3" fill={strokeColor} />
        </g>

        {/* Range Labels */}
        <text x="18" y="98" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">
          0
        </text>
        <text x="80" y="24" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">
          50
        </text>
        <text x="142" y="98" fill="#64748b" fontSize="8" fontFamily="monospace" textAnchor="middle">
          100
        </text>
      </svg>

      <div className="-mt-3 flex flex-col items-center">
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-mono font-extrabold tabular-nums text-white tracking-tight">
            {clamped}
          </span>
          <span className="text-xs font-mono text-slate-400 font-semibold">%</span>
        </div>
        <span
          className={`text-[9px] font-mono px-2 py-0.5 rounded-full border tracking-wider font-semibold uppercase mt-0.5 ${
            clamped >= 75
              ? "bg-rose-950/60 text-rose-300 border-rose-800"
              : clamped >= 40
              ? "bg-amber-950/60 text-amber-300 border-amber-800"
              : "bg-emerald-950/60 text-emerald-300 border-emerald-800"
          }`}
        >
          {badgeText}
        </span>
      </div>
    </div>
  );
}
