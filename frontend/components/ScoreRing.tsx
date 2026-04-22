"use client";

interface Props {
  score: number;
  size?: number;
  label?: string;
  color?: string;
}

export default function ScoreRing({ score, size = 48, label, color }: Props) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circ - (pct / 100) * circ;

  const ringColor = color || (pct >= 70 ? "#4ade80" : pct >= 40 ? "#fbbf24" : "#f87171");

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#232b42" strokeWidth={5} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={ringColor}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="score-ring"
        />
        <text
          x="50%" y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          fill={ringColor}
          fontSize={size * 0.26}
          fontWeight="bold"
          style={{ transform: "rotate(90deg)", transformOrigin: "50% 50%" }}
        >
          {pct}
        </text>
      </svg>
      {label && <span className="text-xs text-slate-500">{label}</span>}
    </div>
  );
}
