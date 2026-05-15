import { useEffect, useRef } from "react";
import katex from "katex";

// Renders inline + display math. We accept the prompt as raw string and split on $...$ and $$...$$.
// Simple but robust enough for the seed problems.

export function MathBlock({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = renderMixed(children);
  }, [children]);
  return <div ref={ref} className={className} />;
}

function renderMixed(input: string): string {
  // Tokenize: $$...$$ (display), $...$ (inline), else plain text.
  const out: string[] = [];
  let i = 0;
  while (i < input.length) {
    if (input.startsWith("$$", i)) {
      const end = input.indexOf("$$", i + 2);
      if (end === -1) {
        out.push(escapeHtml(input.slice(i)));
        break;
      }
      const math = input.slice(i + 2, end);
      out.push(renderKatex(math, true));
      i = end + 2;
    } else if (input[i] === "$") {
      const end = findInlineEnd(input, i + 1);
      if (end === -1) {
        out.push(escapeHtml(input.slice(i)));
        break;
      }
      const math = input.slice(i + 1, end);
      out.push(renderKatex(math, false));
      i = end + 1;
    } else {
      // Plain segment up to next $
      const nextDollar = nextUnescaped(input, i);
      const chunk = input.slice(i, nextDollar === -1 ? input.length : nextDollar);
      out.push(escapeHtml(chunk).replace(/\n/g, "<br/>"));
      if (nextDollar === -1) break;
      i = nextDollar;
    }
  }
  return out.join("");
}

function findInlineEnd(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "$") return i;
  }
  return -1;
}

function nextUnescaped(s: string, from: number): number {
  for (let i = from; i < s.length; i++) {
    if (s[i] === "\\") {
      i++;
      continue;
    }
    if (s[i] === "$") return i;
  }
  return -1;
}

function renderKatex(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: "html" });
  } catch {
    return escapeHtml(tex);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
