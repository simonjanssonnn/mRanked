import { useEffect, useState } from "react";

export function TimerRing({ totalSec, startedAt, frozen }: { totalSec: number; startedAt: number; frozen?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (frozen) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [frozen]);

  const elapsedMs = frozen ? totalSec * 1000 : now - startedAt;
  const remaining = Math.max(0, totalSec * 1000 - elapsedMs);
  const frac = Math.max(0, Math.min(1, remaining / (totalSec * 1000)));

  const size = 168;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - frac);

  const seconds = Math.ceil(remaining / 1000);
  const urgent = remaining < 5000 && remaining > 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(244,248,252,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={urgent ? "#F87171" : "#2DD4BF"}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`text-5xl font-bold tabular-nums ${urgent ? "text-bad" : "text-ink-950"}`}>{seconds}</div>
        <div className="text-xs uppercase tracking-widest text-ink-500">seconds</div>
      </div>
    </div>
  );
}
