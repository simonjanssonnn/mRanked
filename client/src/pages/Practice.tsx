import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { loadSettings, saveSettings } from "../lib/settings";
import { CLASSIC_TIERS, TIER_COLORS } from "../lib/ranks";
import { MathBlock } from "../components/Math";
import { TimerRing } from "../components/TimerRing";
import { PageHeader } from "../components/PageHeader";

type Phase = "picking" | "loading" | "solving" | "result" | "error";

type Problem = {
  id: string;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  options: string[] | null;
  timeLimitSec: number;
  tier: string;
  difficultyElo: number;
};

type Result = {
  correct: boolean;
  accuracy: number;
  correctAnswer: string;
  solution: string;
};

type Difficulty = "auto" | typeof CLASSIC_TIERS[number]["name"];

export function Practice() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  // The picker is the entry screen now — new users don't need to spelunk
  // through Settings to pick a difficulty before practising.
  const [phase, setPhase] = useState<Phase>("picking");
  const [chosen, setChosen] = useState<Difficulty>(() => (loadSettings().preferredTier as Difficulty) || "auto");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function targetEloFor(d: Difficulty): number {
    if (d === "auto") return user?.classicElo ?? 1000;
    const t = CLASSIC_TIERS.find((x) => x.name === d);
    return t ? Math.round((t.min + (t.max === Infinity ? t.min + 200 : t.max)) / 2) : 1000;
  }

  async function newProblem(diff: Difficulty = chosen) {
    setPhase("loading");
    setAnswer("");
    setResult(null);
    try {
      const { problem } = await api.practiceProblem(targetEloFor(diff));
      setProblem(problem);
      setStartedAt(Date.now());
      setPhase("solving");
    } catch {
      setPhase("error");
    }
  }

  function start(d: Difficulty) {
    setChosen(d);
    saveSettings({ preferredTier: d });
    void newProblem(d);
  }

  async function submit(forcedAnswer?: string) {
    if (!problem) return;
    const a = forcedAnswer ?? answer;
    if (!a.trim() && !forcedAnswer) return;
    const r = await api.practiceSubmit(problem.id, a);
    setResult(r);
    setPhase("result");
  }

  return (
    <div className="min-h-screen">
      <PageHeader title="Practice" />

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col items-center">
        {phase === "picking" && (
          <PickDifficulty current={chosen} onPick={start} onCancel={() => navigate("/modes")} />
        )}

        {phase === "loading" && <div className="text-ink-500 py-12">Loading a problem…</div>}

        {phase === "error" && (
          <div className="text-center">
            <div className="text-bad mb-3">Couldn't load a problem.</div>
            <button className="btn-primary px-5 py-2" onClick={() => newProblem()}>Try again</button>
          </div>
        )}

        {phase === "solving" && problem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex flex-col items-center gap-7">
            <div className="text-xs uppercase tracking-widest text-ink-600">
              {problem.tier} · ~{problem.difficultyElo} ELO
            </div>
            <TimerRing totalSec={problem.timeLimitSec} startedAt={startedAt} />
            <div className="card p-6 w-full">
              <MathBlock className="text-2xl leading-relaxed">{problem.prompt}</MathBlock>
            </div>

            {problem.answerType === "multiple_choice" && problem.options ? (
              <div className="grid grid-cols-2 gap-3 w-full">
                {problem.options.map((opt) => (
                  <button key={opt} className="btn-ghost py-4 text-lg" onClick={() => submit(opt)}>
                    <MathBlock>{opt}</MathBlock>
                  </button>
                ))}
              </div>
            ) : (
              <div className="w-full flex gap-3">
                <input
                  autoFocus
                  className="input text-2xl text-center font-mono tabular-nums"
                  placeholder="answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                />
                <button className="btn-primary text-lg px-6" onClick={() => submit()} disabled={!answer.trim()}>Submit</button>
              </div>
            )}

            <button onClick={() => setPhase("picking")} className="text-xs text-ink-500 hover:text-ink-900">← Change difficulty</button>
          </motion.div>
        )}

        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
            <div className="text-center mb-6">
              <div className={`text-sm uppercase tracking-widest mb-1 ${result.correct ? "text-good" : "text-bad"}`}>
                {result.correct ? "Correct" : "Incorrect"}
              </div>
              <div className="text-4xl font-medium tabular-nums">{Math.round(result.accuracy * 100)}%</div>
              <div className="text-xs text-ink-600 mt-1">Accuracy</div>
            </div>
            <div className="card p-6 mb-6">
              <div className="text-xs uppercase tracking-widest text-ink-600 mb-2">Correct answer</div>
              <div className="text-xl mb-4"><MathBlock>{result.correctAnswer}</MathBlock></div>
              <div className="text-xs uppercase tracking-widest text-ink-600 mb-2">Solution</div>
              <MathBlock className="leading-relaxed">{result.solution}</MathBlock>
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-3" onClick={() => setPhase("picking")}>Change difficulty</button>
              <button className="btn-primary flex-1 py-3" onClick={() => newProblem()}>Next problem</button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}

function PickDifficulty({ current, onPick, onCancel }: {
  current: Difficulty;
  onPick: (d: Difficulty) => void;
  onCancel: () => void;
}) {
  const user = useAuth((s) => s.user);

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <div className="text-[10px] uppercase tracking-[0.3em] text-ink-500 mb-2">Practice</div>
        <h1 className="text-3xl font-medium tracking-tight">Pick a difficulty</h1>
        <p className="text-sm text-ink-700 mt-2">Solo. No ELO impact. Switch any time.</p>
      </div>

      <button
        onClick={() => onPick("auto")}
        className={`card w-full p-4 mb-3 flex items-center justify-between hover:border-clay/40 transition-colors ${current === "auto" ? "ring-1 ring-clay/40" : ""}`}
      >
        <div className="text-left">
          <div className="font-medium">Auto</div>
          <div className="text-xs text-ink-600">
            Use your current rating ({user?.classicElo ?? 1000})
          </div>
        </div>
        <span className="chip chip-clay">Recommended</span>
      </button>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {CLASSIC_TIERS.map((t) => {
          const tc = TIER_COLORS[t.name] ?? TIER_COLORS.Initiate;
          const active = current === t.name;
          return (
            <button
              key={t.name}
              onClick={() => onPick(t.name)}
              className={`card p-3 hover:border-clay/40 transition-colors ${active ? "ring-1 ring-clay/40" : ""}`}
            >
              <div className={`text-sm font-medium ${tc.text}`}>{t.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-500 mt-0.5 tabular-nums">
                {t.max === Infinity ? `${t.min}+` : `${t.min}–${t.max}`}
              </div>
            </button>
          );
        })}
      </div>

      <button onClick={onCancel} className="btn-ghost w-full py-3 mt-6">Back to modes</button>
    </div>
  );
}
