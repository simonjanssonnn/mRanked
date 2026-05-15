// Seed the problem bank. ~120 Classic-mode problems across 8 tiers,
// covering arithmetic, algebra, geometry, trigonometry, precalculus,
// calculus, number theory, combinatorics, and probability.

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

type Seed = {
  category: string;
  tier: string;
  difficultyElo: number;
  prompt: string;
  answerType: "numeric" | "multiple_choice";
  correctAnswer: string;
  acceptableForms?: string[];
  tolerance?: number;
  options?: string[];
  solution: string;
  timeLimitSeconds: number;
  calculatorAllowed?: boolean;
};

const PROBLEMS: Seed[] = [
  // ───────── Initiate (0–799) ─────────
  { category: "arithmetic", tier: "Initiate", difficultyElo: 400, prompt: "Compute $7 \\times 8$.", answerType: "numeric", correctAnswer: "56", solution: "$7 \\times 8 = 56$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 420, prompt: "Compute $13 + 27$.", answerType: "numeric", correctAnswer: "40", solution: "$13 + 27 = 40$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 440, prompt: "Compute $100 - 37$.", answerType: "numeric", correctAnswer: "63", solution: "$100 - 37 = 63$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 470, prompt: "Compute $9 \\times 12$.", answerType: "numeric", correctAnswer: "108", solution: "$9 \\times 12 = 108$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 500, prompt: "What is $\\dfrac{3}{4} + \\dfrac{1}{2}$? Enter as a decimal or fraction.", answerType: "numeric", correctAnswer: "1.25", acceptableForms: ["5/4", "1 1/4", "1.25"], tolerance: 1e-6, solution: "$\\dfrac{3}{4} + \\dfrac{2}{4} = \\dfrac{5}{4} = 1.25$.", timeLimitSeconds: 45 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 520, prompt: "Compute $\\dfrac{2}{3} \\times \\dfrac{3}{8}$.", answerType: "numeric", correctAnswer: "0.25", acceptableForms: ["1/4", "0.25"], tolerance: 1e-6, solution: "$\\dfrac{2 \\cdot 3}{3 \\cdot 8} = \\dfrac{1}{4}$.", timeLimitSeconds: 45 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 550, prompt: "What is $30\\%$ of $80$?", answerType: "numeric", correctAnswer: "24", solution: "$0.30 \\cdot 80 = 24$.", timeLimitSeconds: 45 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 580, prompt: "What is $\\dfrac{144}{12}$?", answerType: "numeric", correctAnswer: "12", solution: "$144 / 12 = 12$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 600, prompt: "If a shirt costs \\$24 and is 25\\% off, how many dollars do you pay?", answerType: "numeric", correctAnswer: "18", solution: "$24 \\times 0.75 = 18$.", timeLimitSeconds: 60 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 620, prompt: "A pizza is cut into 8 equal slices. You eat 3. What fraction is left? Enter as decimal.", answerType: "numeric", correctAnswer: "0.625", acceptableForms: ["5/8", "0.625"], tolerance: 1e-6, solution: "$1 - 3/8 = 5/8 = 0.625$.", timeLimitSeconds: 45 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 650, prompt: "Pick: $-7 + 12 = $", answerType: "multiple_choice", correctAnswer: "5", options: ["-19", "-5", "5", "19"], solution: "$-7 + 12 = 5$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 680, prompt: "What is $\\sqrt{81}$?", answerType: "numeric", correctAnswer: "9", solution: "$9^2 = 81$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 700, prompt: "What is $\\sqrt{144}$?", answerType: "numeric", correctAnswer: "12", solution: "$12 \\times 12 = 144$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 720, prompt: "Compute $2^5$.", answerType: "numeric", correctAnswer: "32", solution: "$2^5 = 32$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 750, prompt: "Pick the correct value of $-3 - (-5)$.", answerType: "multiple_choice", correctAnswer: "2", options: ["-8", "-2", "2", "8"], solution: "$-3 - (-5) = -3 + 5 = 2$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Initiate", difficultyElo: 780, prompt: "If 5 apples cost \\$3.50, how many dollars do 8 apples cost?", answerType: "numeric", correctAnswer: "5.6", acceptableForms: ["5.60", "28/5"], tolerance: 1e-2, solution: "Price each $= 0.70$; $8 \\cdot 0.70 = 5.60$.", timeLimitSeconds: 60 },

  // ───────── Bronze (800–1099) ─────────
  { category: "algebra", tier: "Bronze", difficultyElo: 820, prompt: "Solve for $x$: $x + 8 = 21$.", answerType: "numeric", correctAnswer: "13", solution: "$x = 21 - 8 = 13$.", timeLimitSeconds: 30 },
  { category: "algebra", tier: "Bronze", difficultyElo: 850, prompt: "Solve for $x$: $4x = 28$.", answerType: "numeric", correctAnswer: "7", solution: "$x = 28/4 = 7$.", timeLimitSeconds: 30 },
  { category: "algebra", tier: "Bronze", difficultyElo: 880, prompt: "Solve for $x$: $\\dfrac{x}{3} = 12$.", answerType: "numeric", correctAnswer: "36", solution: "$x = 36$.", timeLimitSeconds: 30 },
  { category: "algebra", tier: "Bronze", difficultyElo: 900, prompt: "Solve for $x$: $3x + 7 = 22$.", answerType: "numeric", correctAnswer: "5", solution: "$3x = 15 \\Rightarrow x = 5$.", timeLimitSeconds: 45 },
  { category: "geometry", tier: "Bronze", difficultyElo: 920, prompt: "What is the perimeter of a square with side $9$?", answerType: "numeric", correctAnswer: "36", solution: "$P = 4s = 36$.", timeLimitSeconds: 30 },
  { category: "geometry", tier: "Bronze", difficultyElo: 950, prompt: "A rectangle has length 8 and width 5. What is its area?", answerType: "numeric", correctAnswer: "40", solution: "$A = l \\cdot w = 8 \\cdot 5 = 40$.", timeLimitSeconds: 30 },
  { category: "geometry", tier: "Bronze", difficultyElo: 980, prompt: "A triangle has base $10$ and height $6$. What is its area?", answerType: "numeric", correctAnswer: "30", solution: "$A = \\tfrac{1}{2} b h = 30$.", timeLimitSeconds: 30 },
  { category: "algebra", tier: "Bronze", difficultyElo: 1000, prompt: "If $5x - 2 = 3x + 10$, find $x$.", answerType: "numeric", correctAnswer: "6", solution: "$2x = 12 \\Rightarrow x = 6$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Bronze", difficultyElo: 1020, prompt: "Evaluate $3a - 2b$ when $a = 4, b = 5$.", answerType: "numeric", correctAnswer: "2", solution: "$12 - 10 = 2$.", timeLimitSeconds: 30 },
  { category: "arithmetic", tier: "Bronze", difficultyElo: 1050, prompt: "A car travels 180 km in 3 hours. What is the average speed in km/h?", answerType: "numeric", correctAnswer: "60", solution: "$v = d/t = 60$ km/h.", timeLimitSeconds: 45 },
  { category: "number_theory", tier: "Bronze", difficultyElo: 1070, prompt: "What is the largest prime less than $30$?", answerType: "numeric", correctAnswer: "29", solution: "$29$ is prime; $28, 27, 26$ are not.", timeLimitSeconds: 45 },
  { category: "geometry", tier: "Bronze", difficultyElo: 1090, prompt: "A right triangle has legs of length $6$ and $8$. What is the length of the hypotenuse?", answerType: "numeric", correctAnswer: "10", solution: "$\\sqrt{36 + 64} = 10$.", timeLimitSeconds: 60 },

  // ───────── Silver (1100–1399) ─────────
  { category: "algebra", tier: "Silver", difficultyElo: 1120, prompt: "Solve for $x$: $2(x - 3) = 14$.", answerType: "numeric", correctAnswer: "10", solution: "$x - 3 = 7 \\Rightarrow x = 10$.", timeLimitSeconds: 45 },
  { category: "algebra", tier: "Silver", difficultyElo: 1150, prompt: "Solve the system: $\\begin{cases} x + y = 10 \\\\ x - y = 4 \\end{cases}$. What is $x$?", answerType: "numeric", correctAnswer: "7", solution: "Add: $2x = 14$.", timeLimitSeconds: 90 },
  { category: "algebra", tier: "Silver", difficultyElo: 1180, prompt: "Factor: $x^2 - 5x + 6$. What is the larger root of $x^2 - 5x + 6 = 0$?", answerType: "numeric", correctAnswer: "3", solution: "$(x-2)(x-3) = 0$; roots $2, 3$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Silver", difficultyElo: 1200, prompt: "Simplify: $\\dfrac{x^2 - 9}{x - 3}$ for $x \\ne 3$.", answerType: "multiple_choice", correctAnswer: "x + 3", options: ["x - 3", "x + 3", "x^2 + 3", "1"], solution: "$x^2 - 9 = (x-3)(x+3)$.", timeLimitSeconds: 60 },
  { category: "geometry", tier: "Silver", difficultyElo: 1230, prompt: "What is the area of a circle with radius $4$? Give the answer as $k\\pi$ and enter $k$.", answerType: "numeric", correctAnswer: "16", solution: "$A = \\pi r^2 = 16\\pi$.", timeLimitSeconds: 45 },
  { category: "geometry", tier: "Silver", difficultyElo: 1250, prompt: "Find the slope of the line through $(2, -1)$ and $(5, 8)$.", answerType: "numeric", correctAnswer: "3", solution: "$m = 9/3 = 3$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Silver", difficultyElo: 1280, prompt: "If $f(x) = x^2 + 1$, what is $f(-3)$?", answerType: "numeric", correctAnswer: "10", solution: "$(-3)^2 + 1 = 10$.", timeLimitSeconds: 45 },
  { category: "algebra", tier: "Silver", difficultyElo: 1300, prompt: "If $2^x = 32$, find $x$.", answerType: "numeric", correctAnswer: "5", solution: "$32 = 2^5$.", timeLimitSeconds: 45 },
  { category: "probability", tier: "Silver", difficultyElo: 1330, prompt: "A fair coin is flipped 3 times. How many sequences have exactly 2 heads?", answerType: "numeric", correctAnswer: "3", solution: "$\\binom{3}{2} = 3$.", timeLimitSeconds: 60 },
  { category: "number_theory", tier: "Silver", difficultyElo: 1360, prompt: "What is the LCM of $12$ and $18$?", answerType: "numeric", correctAnswer: "36", solution: "$12 = 2^2 \\cdot 3$, $18 = 2 \\cdot 3^2$; $\\mathrm{lcm} = 36$.", timeLimitSeconds: 60 },
  { category: "number_theory", tier: "Silver", difficultyElo: 1380, prompt: "What is the greatest common divisor of $84$ and $126$?", answerType: "numeric", correctAnswer: "42", solution: "$\\gcd = 2 \\cdot 3 \\cdot 7 = 42$.", timeLimitSeconds: 90 },

  // ───────── Gold (1400–1699) ─────────
  { category: "algebra", tier: "Gold", difficultyElo: 1420, prompt: "Solve $|2x - 5| = 9$. Enter the larger root.", answerType: "numeric", correctAnswer: "7", solution: "$2x - 5 = \\pm 9$, so $x \\in \\{-2, 7\\}$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Gold", difficultyElo: 1450, prompt: "Find the sum of the roots of $x^2 - 7x + 12 = 0$.", answerType: "numeric", correctAnswer: "7", solution: "Vieta: $-b/a = 7$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Gold", difficultyElo: 1480, prompt: "Find the product of the roots of $2x^2 - 5x - 3 = 0$.", answerType: "numeric", correctAnswer: "-1.5", acceptableForms: ["-3/2", "-1.5"], tolerance: 1e-6, solution: "Vieta: $c/a = -3/2$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Gold", difficultyElo: 1500, prompt: "Solve $x^2 - 6x + 9 = 0$.", answerType: "numeric", correctAnswer: "3", solution: "$(x-3)^2 = 0$.", timeLimitSeconds: 60 },
  { category: "geometry", tier: "Gold", difficultyElo: 1530, prompt: "Find the distance between $(1, 2)$ and $(4, 6)$.", answerType: "numeric", correctAnswer: "5", solution: "$\\sqrt{9 + 16} = 5$.", timeLimitSeconds: 45 },
  { category: "trigonometry", tier: "Gold", difficultyElo: 1550, prompt: "What is $\\sin(30^\\circ) + \\cos(60^\\circ)$?", answerType: "numeric", correctAnswer: "1", solution: "Both equal $1/2$.", timeLimitSeconds: 60 },
  { category: "trigonometry", tier: "Gold", difficultyElo: 1580, prompt: "Compute $\\tan(45^\\circ) \\cdot \\sin(90^\\circ)$.", answerType: "numeric", correctAnswer: "1", solution: "$1 \\cdot 1 = 1$.", timeLimitSeconds: 45 },
  { category: "geometry", tier: "Gold", difficultyElo: 1620, prompt: "A circle has area $25\\pi$. What is its circumference? Use the exact form $k\\pi$ and enter $k$.", answerType: "numeric", correctAnswer: "10", solution: "$r = 5$, $C = 10\\pi$.", timeLimitSeconds: 90 },
  { category: "algebra", tier: "Gold", difficultyElo: 1650, prompt: "If $\\log_{10}(x) = 3$, find $x$.", answerType: "numeric", correctAnswer: "1000", solution: "$x = 10^3 = 1000$.", timeLimitSeconds: 45 },
  { category: "algebra", tier: "Gold", difficultyElo: 1680, prompt: "If $f(x) = 2x^2 - 3x + 1$, what is $f(4)$?", answerType: "numeric", correctAnswer: "21", solution: "$32 - 12 + 1 = 21$.", timeLimitSeconds: 60 },

  // ───────── Platinum (1700–1999) ─────────
  { category: "precalculus", tier: "Platinum", difficultyElo: 1720, prompt: "Evaluate $\\log_3 81$.", answerType: "numeric", correctAnswer: "4", solution: "$3^4 = 81$.", timeLimitSeconds: 45 },
  { category: "precalculus", tier: "Platinum", difficultyElo: 1750, prompt: "Evaluate $\\log_2 32 + \\log_2 \\dfrac{1}{4}$.", answerType: "numeric", correctAnswer: "3", solution: "$5 + (-2) = 3$.", timeLimitSeconds: 75 },
  { category: "precalculus", tier: "Platinum", difficultyElo: 1780, prompt: "Solve $e^x = 7.389$ for $x$ (to 1 decimal).", answerType: "numeric", correctAnswer: "2", tolerance: 0.05, solution: "$e^2 \\approx 7.389$.", timeLimitSeconds: 60 },
  { category: "precalculus", tier: "Platinum", difficultyElo: 1800, prompt: "Compute the sum $1 + 2 + 3 + \\dots + 100$.", answerType: "numeric", correctAnswer: "5050", solution: "$n(n+1)/2$.", timeLimitSeconds: 60 },
  { category: "precalculus", tier: "Platinum", difficultyElo: 1830, prompt: "Compute $\\sum_{k=1}^{10} k^2$.", answerType: "numeric", correctAnswer: "385", solution: "$\\frac{n(n+1)(2n+1)}{6} = \\frac{10 \\cdot 11 \\cdot 21}{6} = 385$.", timeLimitSeconds: 75 },
  { category: "trigonometry", tier: "Platinum", difficultyElo: 1860, prompt: "Compute $\\sin^2 30^\\circ + \\cos^2 30^\\circ$.", answerType: "numeric", correctAnswer: "1", solution: "Pythagorean identity.", timeLimitSeconds: 30 },
  { category: "trigonometry", tier: "Platinum", difficultyElo: 1880, prompt: "Find the smallest positive value of $x$ in degrees with $\\sin x = \\dfrac{\\sqrt{3}}{2}$.", answerType: "numeric", correctAnswer: "60", solution: "$\\sin 60^\\circ = \\sqrt 3 / 2$.", timeLimitSeconds: 75 },
  { category: "algebra", tier: "Platinum", difficultyElo: 1920, prompt: "Find the sum of the infinite series $\\sum_{n=1}^\\infty \\frac{1}{2^n}$.", answerType: "numeric", correctAnswer: "1", solution: "$\\frac{1/2}{1 - 1/2} = 1$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Platinum", difficultyElo: 1950, prompt: "If the geometric series $\\sum_{n=0}^{\\infty} \\left(\\dfrac{1}{3}\\right)^n$ converges, what is its sum?", answerType: "numeric", correctAnswer: "1.5", acceptableForms: ["3/2"], tolerance: 1e-6, solution: "$S = 1/(1 - 1/3) = 3/2$.", timeLimitSeconds: 90 },
  { category: "precalculus", tier: "Platinum", difficultyElo: 1990, prompt: "How many distinct real roots does $x^4 - 5x^2 + 4 = 0$ have?", answerType: "numeric", correctAnswer: "4", solution: "$u = x^2$ → $u \\in \\{1,4\\}$ → $x \\in \\{\\pm 1, \\pm 2\\}$.", timeLimitSeconds: 120 },

  // ───────── Diamond (2000–2299) ─────────
  { category: "calculus", tier: "Diamond", difficultyElo: 2020, prompt: "Compute $\\dfrac{d}{dx}(x^3 - 4x + 7)$ at $x = 2$.", answerType: "numeric", correctAnswer: "8", solution: "$3x^2 - 4 = 12 - 4 = 8$.", timeLimitSeconds: 60 },
  { category: "calculus", tier: "Diamond", difficultyElo: 2050, prompt: "Evaluate $\\displaystyle \\int_0^1 (3x^2 + 2x)\\,dx$.", answerType: "numeric", correctAnswer: "2", solution: "$[x^3 + x^2]_0^1 = 2$.", timeLimitSeconds: 120 },
  { category: "calculus", tier: "Diamond", difficultyElo: 2080, prompt: "$\\displaystyle \\int_0^{\\pi} \\sin x\\,dx = ?$", answerType: "numeric", correctAnswer: "2", solution: "$[-\\cos x]_0^\\pi = 1 + 1 = 2$.", timeLimitSeconds: 90 },
  { category: "calculus", tier: "Diamond", difficultyElo: 2100, prompt: "Find $\\lim_{x \\to 0} \\dfrac{\\sin(3x)}{x}$.", answerType: "numeric", correctAnswer: "3", solution: "$3 \\cdot \\lim \\sin(3x)/(3x) = 3$.", timeLimitSeconds: 120 },
  { category: "calculus", tier: "Diamond", difficultyElo: 2130, prompt: "Find $\\lim_{x \\to \\infty} \\dfrac{2x^2 + 3}{x^2 - 1}$.", answerType: "numeric", correctAnswer: "2", solution: "Ratio of leading coefficients.", timeLimitSeconds: 75 },
  { category: "number_theory", tier: "Diamond", difficultyElo: 2160, prompt: "How many positive divisors does $360$ have?", answerType: "numeric", correctAnswer: "24", solution: "$360 = 2^3 \\cdot 3^2 \\cdot 5$; $d(n) = 4 \\cdot 3 \\cdot 2 = 24$.", timeLimitSeconds: 90 },
  { category: "number_theory", tier: "Diamond", difficultyElo: 2180, prompt: "What is $7^{100} \\pmod{10}$?", answerType: "numeric", correctAnswer: "1", solution: "Cycle $7,9,3,1$; $100 \\equiv 0 \\pmod 4$.", timeLimitSeconds: 180 },
  { category: "probability", tier: "Diamond", difficultyElo: 2210, prompt: "Two dice are rolled. What is the probability the sum is $7$? Enter as a fraction $a/b$ in lowest terms.", answerType: "numeric", correctAnswer: "0.16666667", acceptableForms: ["1/6"], tolerance: 1e-3, solution: "6 ways out of 36; $1/6$.", timeLimitSeconds: 90 },
  { category: "calculus", tier: "Diamond", difficultyElo: 2240, prompt: "Find the maximum value of $f(x) = -x^2 + 4x + 5$.", answerType: "numeric", correctAnswer: "9", solution: "Vertex at $x = 2$, $f(2) = 9$.", timeLimitSeconds: 120 },
  { category: "combinatorics", tier: "Diamond", difficultyElo: 2270, prompt: "How many 4-digit numbers have all distinct digits and first digit non-zero?", answerType: "numeric", correctAnswer: "4536", solution: "$9 \\cdot 9 \\cdot 8 \\cdot 7 = 4536$.", timeLimitSeconds: 180 },
  { category: "combinatorics", tier: "Diamond", difficultyElo: 2290, prompt: "In how many ways can the letters in MISSISSIPPI be arranged?", answerType: "numeric", correctAnswer: "34650", solution: "$\\dfrac{11!}{4!\\,4!\\,2!} = 34650$.", timeLimitSeconds: 180 },

  // ───────── Master (2300–2599) ─────────
  { category: "combinatorics", tier: "Master", difficultyElo: 2320, prompt: "In how many ways can 5 books be lined up on a shelf?", answerType: "numeric", correctAnswer: "120", solution: "$5! = 120$.", timeLimitSeconds: 60 },
  { category: "combinatorics", tier: "Master", difficultyElo: 2350, prompt: "How many positive integer solutions does $x + y + z = 10$ have?", answerType: "numeric", correctAnswer: "36", solution: "Stars and bars: $\\binom{9}{2} = 36$.", timeLimitSeconds: 240 },
  { category: "combinatorics", tier: "Master", difficultyElo: 2380, prompt: "How many non-negative integer solutions does $x + y + z = 10$ have?", answerType: "numeric", correctAnswer: "66", solution: "$\\binom{12}{2} = 66$.", timeLimitSeconds: 120 },
  { category: "number_theory", tier: "Master", difficultyElo: 2400, prompt: "Find the units digit of $7^{2026}$.", answerType: "numeric", correctAnswer: "9", solution: "Cycle $7,9,3,1$; $2026 \\equiv 2 \\pmod 4$; digit is $9$.", timeLimitSeconds: 120 },
  { category: "number_theory", tier: "Master", difficultyElo: 2420, prompt: "Find the units digit of $3^{2027}$.", answerType: "numeric", correctAnswer: "7", solution: "Cycle $3,9,7,1$; $2027 \\equiv 3$.", timeLimitSeconds: 180 },
  { category: "number_theory", tier: "Master", difficultyElo: 2450, prompt: "What is $2^{10} \\pmod{1000}$?", answerType: "numeric", correctAnswer: "24", solution: "$1024 \\bmod 1000 = 24$.", timeLimitSeconds: 60 },
  { category: "algebra", tier: "Master", difficultyElo: 2490, prompt: "If $a + b = 6$ and $ab = 5$, find $a^3 + b^3$.", answerType: "numeric", correctAnswer: "126", solution: "$(a+b)^3 - 3ab(a+b) = 216 - 90 = 126$.", timeLimitSeconds: 180 },
  { category: "algebra", tier: "Master", difficultyElo: 2520, prompt: "If $a + b + c = 6$, $ab + bc + ca = 11$, $abc = 6$, find $a^2 + b^2 + c^2$.", answerType: "numeric", correctAnswer: "14", solution: "$(a+b+c)^2 - 2(ab+bc+ca) = 36 - 22 = 14$.", timeLimitSeconds: 180 },
  { category: "geometry", tier: "Master", difficultyElo: 2550, prompt: "A triangle has sides $13$, $14$, $15$. What is its area?", answerType: "numeric", correctAnswer: "84", solution: "Heron: $s=21$, area $=\\sqrt{21 \\cdot 8 \\cdot 7 \\cdot 6} = 84$.", timeLimitSeconds: 240 },
  { category: "combinatorics", tier: "Master", difficultyElo: 2590, prompt: "A 5-card hand is dealt from a standard 52-card deck. How many hands contain exactly two pairs (and one other card not matching either pair)?", answerType: "numeric", correctAnswer: "123552", solution: "$\\binom{13}{2}\\binom{4}{2}^2 \\cdot 11 \\cdot 4 = 123552$.", timeLimitSeconds: 300 },

  // ───────── Grandmaster (2600+) ─────────
  { category: "number_theory", tier: "Grandmaster", difficultyElo: 2620, prompt: "Find the remainder when $2^{100}$ is divided by $7$.", answerType: "numeric", correctAnswer: "2", solution: "$2^3 \\equiv 1 \\pmod 7$; $100 = 3 \\cdot 33 + 1$; $2^{100} \\equiv 2^1 = 2$.", timeLimitSeconds: 240 },
  { category: "combinatorics", tier: "Grandmaster", difficultyElo: 2660, prompt: "How many subsets of $\\{1, 2, 3, \\dots, 10\\}$ contain no two consecutive integers? (Include the empty set.)", answerType: "numeric", correctAnswer: "144", solution: "Fibonacci: $a_n = a_{n-1} + a_{n-2}$; $a_{10} = 144$.", timeLimitSeconds: 360 },
  { category: "algebra", tier: "Grandmaster", difficultyElo: 2700, prompt: "Find $\\displaystyle \\sum_{k=1}^{\\infty} \\frac{k}{2^k}$.", answerType: "numeric", correctAnswer: "2", solution: "$\\sum k x^k = \\frac{x}{(1-x)^2}$ at $x = 1/2$: $\\frac{1/2}{1/4} = 2$.", timeLimitSeconds: 360 },
  { category: "algebra", tier: "Grandmaster", difficultyElo: 2740, prompt: "Find the largest value of $k$ such that $x^2 + kx + 9$ has two real roots both negative.", answerType: "numeric", correctAnswer: "6", solution: "Discriminant $\\ge 0$: $k^2 \\ge 36$. Both roots negative: sum $-k < 0$ and product $9 > 0$. So $k > 0$ and $k \\ge 6$. Largest value comes from boundary $k = 6$ (double root at $-3$).", timeLimitSeconds: 360 },
  { category: "algebra", tier: "Grandmaster", difficultyElo: 2780, prompt: "Find the maximum value of $xy$ subject to $x^2 + 4y^2 = 8$, where $x, y \\ge 0$.", answerType: "numeric", correctAnswer: "2", tolerance: 1e-3, solution: "AM-GM: $x^2 + 4y^2 \\ge 4|xy|$, so $xy \\le 2$.", timeLimitSeconds: 420 },
  { category: "geometry", tier: "Grandmaster", difficultyElo: 2820, prompt: "Triangle $ABC$ has $\\angle A = 60^\\circ$, $AB = 7$, and $AC = 8$. What is $BC^2$?", answerType: "numeric", correctAnswer: "57", solution: "Law of cosines: $49 + 64 - 56 = 57$.", timeLimitSeconds: 300 },
  { category: "geometry", tier: "Grandmaster", difficultyElo: 2860, prompt: "A regular hexagon has area $96\\sqrt 3$. What is its side length?", answerType: "numeric", correctAnswer: "8", solution: "Area $= \\frac{3\\sqrt 3}{2} s^2$; $\\frac{3\\sqrt 3}{2} s^2 = 96 \\sqrt 3 \\Rightarrow s^2 = 64 \\Rightarrow s = 8$.", timeLimitSeconds: 360 },
  { category: "calculus", tier: "Grandmaster", difficultyElo: 2900, prompt: "Compute $\\displaystyle \\int_0^{\\pi/2} \\sin^2 x\\,dx$.", answerType: "numeric", correctAnswer: "0.7854", acceptableForms: ["\\pi/4", "pi/4"], tolerance: 1e-3, solution: "$\\int \\sin^2 x\\,dx = \\frac{x}{2} - \\frac{\\sin 2x}{4}$; at $\\pi/2$: $\\pi/4$.", timeLimitSeconds: 420 },
];

async function main() {
  console.log("Seeding problems…");
  await prisma.problem.deleteMany({});

  for (const p of PROBLEMS) {
    await prisma.problem.create({
      data: {
        mode: "classic",
        category: p.category,
        tier: p.tier,
        difficultyElo: p.difficultyElo,
        prompt: p.prompt,
        answerType: p.answerType,
        correctAnswer: p.correctAnswer,
        acceptableForms: p.acceptableForms ? JSON.stringify(p.acceptableForms) : null,
        tolerance: p.tolerance ?? (p.answerType === "numeric" ? 1e-6 : 0),
        options: p.options ? JSON.stringify(p.options) : null,
        solution: p.solution,
        timeLimitSeconds: p.timeLimitSeconds,
        calculatorAllowed: p.calculatorAllowed ?? false,
        language: "en",
      },
    });
  }
  console.log(`Inserted ${PROBLEMS.length} problems.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
