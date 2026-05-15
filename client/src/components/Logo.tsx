type Props = {
  size?: number;
  withWordmark?: boolean;
  className?: string;
};

// Gemini-style 4-pointed spark: four curved blades meeting at a soft centre,
// blue→purple→pink gradient. Pure SVG, scales for header / favicon / hero.
export function Logo({ size = 32, withWordmark = true, className = "" }: Props) {
  const id = "logo-spark-grad";
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="45%" stopColor="#8AB4F8" />
            <stop offset="80%" stopColor="#C58AF9" />
            <stop offset="100%" stopColor="#F472B6" />
          </linearGradient>
        </defs>
        {/* Four cubic-curved petals tapering to the centre form the spark. */}
        <path
          d="M16 1
             C 17.6 9.4, 22.6 14.4, 31 16
             C 22.6 17.6, 17.6 22.6, 16 31
             C 14.4 22.6, 9.4 17.6, 1 16
             C 9.4 14.4, 14.4 9.4, 16 1 Z"
          fill={`url(#${id})`}
        />
      </svg>
      {withWordmark && (
        <div className="leading-tight">
          <div className="text-lg font-medium tracking-tight text-ink-950">
            Math <span className="text-clay">Ranked</span>
          </div>
        </div>
      )}
    </div>
  );
}
