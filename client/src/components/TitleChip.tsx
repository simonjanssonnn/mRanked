import { TITLE_STYLES, getTitle } from "../lib/titles";

type Size = "xs" | "sm" | "md";
const SIZES: Record<Size, string> = {
  xs: "px-1.5 py-0.5 text-[9px]",
  sm: "px-2 py-0.5 text-[10px]",
  md: "px-2.5 py-1 text-xs",
};

export function TitleChip({ titleId, size = "sm" }: { titleId: string; size?: Size }) {
  if (!titleId) return null;
  const title = getTitle(titleId);
  if (!title) return null;
  const style = TITLE_STYLES[title.tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full uppercase tracking-[0.12em] font-semibold ${SIZES[size]} ${style.chip}`}
    >
      {style.icon && <span className={`${style.label} leading-none`}>{style.icon}</span>}
      <span className={style.label}>{title.label}</span>
    </span>
  );
}
