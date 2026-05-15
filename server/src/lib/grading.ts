// Accuracy scoring per §5g.
// MVP supports numeric and multiple_choice. Expression / multi-step land in Phase 3.

export type AnswerType = "numeric" | "multiple_choice";

export type GradeInput = {
  answerType: AnswerType;
  submitted: string | null;  // raw user input; null = no submission
  correctAnswer: string;     // canonical
  tolerance?: number;        // absolute tolerance for numeric (e.g. 1e-6 for exact, 0.01 for loose)
  acceptableForms?: string[]; // alternate exact strings (e.g. "1/2", "0.5")
};

export type GradeResult = {
  correct: boolean;
  accuracy: number; // 0..1
};

// Tolerance band for the "how close did they get" curve on numeric answers.
// Beyond this multiple of the tolerance, accuracy hits 0.
const NUMERIC_ACCURACY_BAND_MULTIPLIER = 50;

export function grade(input: GradeInput): GradeResult {
  if (input.submitted === null || input.submitted.trim() === "") {
    return { correct: false, accuracy: 0 };
  }
  switch (input.answerType) {
    case "numeric":
      return gradeNumeric(input);
    case "multiple_choice":
      return gradeMultipleChoice(input);
  }
}

function gradeNumeric(input: GradeInput): GradeResult {
  const tolerance = input.tolerance ?? 1e-6;
  const target = parseFlexibleNumber(input.correctAnswer);
  const submitted = parseFlexibleNumber(input.submitted!);
  if (target === null || submitted === null) {
    // Couldn't parse — try acceptable forms as exact strings
    if (input.acceptableForms?.some((s) => normalize(s) === normalize(input.submitted!))) {
      return { correct: true, accuracy: 1 };
    }
    return { correct: false, accuracy: 0 };
  }
  const err = Math.abs(submitted - target);
  if (err <= tolerance) return { correct: true, accuracy: 1 };

  // Accuracy decays linearly out to NUMERIC_ACCURACY_BAND_MULTIPLIER * tolerance
  // (or, if tolerance is 0/tiny, scaled relative to |target|).
  const band = Math.max(tolerance * NUMERIC_ACCURACY_BAND_MULTIPLIER, Math.abs(target) * 0.5, 1);
  const accuracy = clamp(1 - err / band, 0, 1);
  return { correct: false, accuracy };
}

function gradeMultipleChoice(input: GradeInput): GradeResult {
  const correct = normalize(input.submitted!) === normalize(input.correctAnswer);
  return { correct, accuracy: correct ? 1 : 0 };
}

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

// Accept "1/2", "0.5", "0,5", " 12 ", "-3.14e2"
export function parseFlexibleNumber(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  // fraction "a/b"
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const num = parseFloat(frac[1]);
    const den = parseFloat(frac[2]);
    if (den === 0) return null;
    return num / den;
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}
