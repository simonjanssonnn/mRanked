import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";
import { loadSettings } from "../lib/settings";
import { CLASSIC_TIERS } from "../lib/ranks";
import { MathBlock } from "../components/Math";
import { TimerRing } from "../components/TimerRing";

type Phase = "loading" | "solving" | "result" | "error";

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

export function Practice() {
  const navigate = useNavigate();
  const user = useAuth((s) => s.user);
  const [phase, setPhase] = useState<Phase>("loading");
  const [problem, setProblem] = useState<Problem | null>(null);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  function targetElo(): number {
    const s = loadSettings();
    if (s.preferredTier === "auto") return user?.classicElo ?? 1000;
    const t = CLASSIC_TIERS.find((x) => x.name === s.preferredTier);
    return t ? Math.round((t.min + (t.max === Infinity ? t.min + 200 : t.max)) / 2) : 1000;
  }

  async function newProblem() {
    setPhase("loading");
    setAnswer("");
    setResult(null);
    try {
      const { problem } = await api.practiceProblem(targetElo());
      setProblem(problem);
      setStartedAt(Date.now());
      setPhase("solving");
    } catch {
      setPhase("error");
    }
  }

  useEffect(() => { void newProblem(); /* eslint-disable-next-line */ }, []);

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
      <header className="px-6 py-5 flex items-center justify-between border-b border-cream-200">
        <button className="btn-subtle text-sm" onClick={() => navigate("/", { replace: true })}>← Home</button>
        <div className="font-serif text-xl">Practice</div>
        <span className="w-12" />
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col items-center">
        {phase === "loading" && <div className="text-ink-500">Loading a problem…</div>}

        {phase === "error" && (
          <div className="text-center">
            <div className="text-bad mb-3">Couldn't load a problem.</div>
            <button className="btn-primary" onClick={newProblem}>Try again</button>
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
          </motion.div>
        )}

        {phase === "result" && result && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full">
            <div className="text-center mb-6">
              <div className={`text-sm uppercase tracking-widest mb-1 ${result.correct ? "text-good" : "text-bad"}`}>
                {result.correct ? "Correct" : "Incorrect"}
              </div>
              <div className="text-4xl font-bold tabular-nums">{Math.round(result.accuracy * 100)}%</div>
              <div className="text-xs text-ink-600 mt-1">Accuracy</div>
            </div>
            <div className="card p-6 mb-6">
              <div className="text-xs uppercase tracking-widest text-ink-600 mb-2">Correct answer</div>
              <div className="text-xl mb-4"><MathBlock>{result.correctAnswer}</MathBlock></div>
              <div className="text-xs uppercase tracking-widest text-ink-600 mb-2">Solution</div>
              <MathBlock className="leading-relaxed">{result.solution}</MathBlock>
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost flex-1 py-3" onClick={() => navigate("/", { replace: true })}>Done</button>
              <button className="btn-primary flex-1 py-3" onClick={newProblem}>Next problem</button>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
