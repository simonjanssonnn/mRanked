type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

// Brand mark: a stylised "MR" monogram inside a chamfered hex, paired with the
// "Math Ranked" wordmark. Pure SVG so it scales for the header, favicon, and
// hero use without any extra assets.
export function Logo({ size = 36, withWordmark = true, className = "" }: Props) {
  const id = "logo-grad";
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#22D3EE" />
            <stop offset="55%" stopColor="#67E8F9" />
            <stop offset="100%" stopColor="#A78BFA" />
          </linearGradient>
          <linearGradient id={`${id}-inner`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        {/* Outer chamfered hex */}
        <path
          d="M11 3 L29 3 L37 11 L37 29 L29 37 L11 37 L3 29 L3 11 Z"
          fill={`url(#${id})`}
        />
        {/* Glass highlight */}
        <path
          d="M11 3 L29 3 L37 11 L37 18 L3 18 L3 11 Z"
          fill={`url(#${id}-inner)`}
        />
        {/* Inner "M" stroke + chevron / rank tick */}
        <path
          d="M11 28 L11 14 L15 14 L20 22 L25 14 L29 14 L29 28 L25.5 28 L25.5 19.5 L21 26.5 L19 26.5 L14.5 19.5 L14.5 28 Z"
          fill="#070C1A"
        />
        {/* Rank chevron under the M — signals “ranked” */}
        <path
          d="M14 31 L20 35 L26 31"
          stroke="#070C1A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
      {withWordmark && (
        <div className="leading-tight">
          <div className="font-serif text-xl tracking-tight text-ink-950">Math <span className="text-clay">Ranked</span></div>
        </div>
      )}
    </div>
  );
}
