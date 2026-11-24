// Parsons problems, ported from js-parsons (parsons.js, ParsonsWidget.parseCode,
// ParsonsCodeline, normalizeIndents) and the Codio generator (data-helper.ts).
//
// A problem is stored as one "initial" string, the same format the generator
// exports: one line of code per row, indentation kept as leading spaces, and
// each extra (distractor) line ends with "#distractor".

import { ParsonsLine } from "../types";

export interface ParsedProblem {
  solution: ParsonsLine[]; // the lines in the right order, indentation normalized
  distractors: string[]; // extra lines that don't belong to the answer
  errors: string[]; // problems with the code, e.g. an indent that doesn't match
}

const DISTRACTOR_SUFFIX = /#distractor\s*$/;
const DISTRACTOR_TAG = "#distractor";

// Trims both ends and drops the distractor tag, as ParsonsCodeline does.
// Everything else is kept exactly as typed. ParsonsCodeline also turns a "\n"
// written inside a line into a real line break (its way of joining lines into
// one block), but here teachers paste real code, where "\n" is an escape in a
// string such as cout << "Done\n"; and must reach students unchanged.
function codeOf(text: string): string {
  return text.replace(DISTRACTOR_SUFFIX, "").replace(/^\s*(.*?)\s*$/, "$1");
}

// Number of leading whitespace characters. Tabs and spaces both count as one.
function leadingWhitespace(text: string): number {
  return text.length - text.replace(/^\s+/, "").length;
}

// Turns raw indentation (the number of leading spaces) into levels that stay
// consistent with the lines around them. Returns -1 for a line whose indent
// matches no earlier line, which Python would reject as an IndentationError.
export function normalizeIndents<T extends { indent: number }>(lines: T[]): T[] {
  const normalized: T[] = [];
  const matchIndent = (index: number): number => {
    for (let i = index - 1; i >= 0; i--) {
      if (lines[i].indent === lines[index].indent) return normalized[i].indent;
    }
    return -1;
  };

  for (let i = 0; i < lines.length; i++) {
    const copy = { ...lines[i] };
    if (i === 0) {
      copy.indent = lines[i].indent !== 0 ? -1 : 0;
    } else if (lines[i].indent === lines[i - 1].indent) {
      copy.indent = normalized[i - 1].indent;
    } else if (lines[i].indent > lines[i - 1].indent) {
      copy.indent = normalized[i - 1].indent + 1;
    } else {
      copy.indent = matchIndent(i);
    }
    normalized[i] = copy;
  }
  return normalized;
}

// Reads a problem from its "initial" string, the way ParsonsWidget.parseCode does.
// Blank lines are skipped. A line that ends with #distractor becomes an extra line.
export function parseInitial(initial: string): ParsedProblem {
  const indented: { code: string; indent: number; line: number }[] = [];
  const distractors: string[] = [];

  initial.split("\n").forEach((text, index) => {
    const code = codeOf(text);
    if (code.length === 0) return;
    if (DISTRACTOR_SUFFIX.test(text)) {
      distractors.push(code);
    } else {
      indented.push({ code, indent: leadingWhitespace(text), line: index + 1 });
    }
  });

  const normalized = normalizeIndents(indented);
  const errors = normalized
    .filter((line) => line.indent < 0)
    .map((line) => `Based on language syntax, the highlighted fragment (${line.line}) is not correctly indented.`);

  return {
    solution: normalized.map(({ code, indent }) => ({ code, indent })),
    distractors,
    errors,
  };
}

// Reverses buildInitial, for editing: splits a stored "initial" string back into
// the code and extra-lines text a teacher sees in the two boxes. A line is an
// extra line if it carries the #distractor tag (the same test parseInitial
// uses), so this agrees with how the problem is graded. Code and distractor
// lines each keep their original text and order; only the tag is removed from
// a distractor line. A line that happens to end in literal "#distractor" is
// read back as a distractor either way -- buildInitial can't tell those apart
// either, so this isn't a new ambiguity. Blank lines (exactly "") that
// buildInitial drops when saving can't be recovered here, same as it already
// can't recover them for a freshly created activity reopened without editing.
export function splitInitial(initial: string): { code: string; distractors: string } {
  const code: string[] = [];
  const distractors: string[] = [];
  for (const line of initial.split("\n")) {
    if (DISTRACTOR_SUFFIX.test(line)) {
      distractors.push(line.replace(DISTRACTOR_SUFFIX, ""));
    } else {
      code.push(line);
    }
  }
  return { code: code.join("\n"), distractors: distractors.join("\n") };
}

// The "initial" string for a problem: the code, then each extra line tagged
// with #distractor. Matches collectCommonSettings in the generator.
export function buildInitial(code: string, distractors: string): string {
  const codeLines = code.split("\n");
  const extraLines = distractors
    .split("\n")
    .filter((line) => line !== "")
    .map((line) => `${line}${DISTRACTOR_TAG}`);
  return codeLines
    .concat(extraLines)
    .filter((line) => line !== "")
    .join("\n");
}

// The reverse of buildInitial: splits a stored problem back into the code and
// extra lines the teacher typed, one per row, with their own indentation kept.
// Blank lines are the only thing lost, since buildInitial drops them.
export function splitInitial(initial: string): { code: string; distractors: string } {
  const code: string[] = [];
  const distractors: string[] = [];
  for (const line of initial.split("\n")) {
    if (DISTRACTOR_SUFFIX.test(line)) distractors.push(line.replace(DISTRACTOR_SUFFIX, ""));
    else code.push(line);
  }
  return { code: code.join("\n"), distractors: distractors.join("\n") };
}

// A source of random numbers from 0 (inclusive) to 1, like Math.random.
export type Random = () => number;

// Fisher-Yates shuffle. Used for the order of lines and for picking extra lines.
export function shuffle<T>(items: T[], random: Random = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Counting numbers from start, count of them: range(2, 3) is [2, 3, 4].
const range = (start: number, count: number): number[] => Array.from({ length: count }, (_, i) => start + i);

// The lines a student is given, as positions in the problem's lines: the
// solution's lines come first (0 up to solutionCount - 1), then the extra
// lines. Every solution line, plus up to maxWrongLines extra lines picked at
// random, all in a random order. Same as the widget's init and shuffleLines.
// The order says which lines are the answer, so it never leaves the server;
// students only get the lines' text (poolLines).
export function studentPoolOrder(
  solutionCount: number,
  distractorCount: number,
  maxWrongLines: number,
  random: Random = Math.random
): number[] {
  const picked = shuffle(range(solutionCount, distractorCount), random).slice(0, Math.max(0, maxWrongLines));
  return shuffle([...range(0, solutionCount), ...picked], random);
}

// The text of each line in a pool order.
export function poolLines(order: number[], solution: ParsonsLine[], distractors: string[]): string[] {
  const all = [...solution.map((line) => line.code), ...distractors];
  return order.map((position) => all[position]);
}

// The lines a student starts with, as text. See studentPoolOrder. Pass a
// seeded random (see seededRandom) to give the same student the same lines
// every time they join.
export function studentPool(
  solution: ParsonsLine[],
  distractors: string[],
  maxWrongLines: number,
  random: Random = Math.random
): string[] {
  return poolLines(studentPoolOrder(solution.length, distractors.length, maxWrongLines, random), solution, distractors);
}

// A repeatable random source from 32 bytes of seed (e.g. an HMAC digest), using
// the sfc32 generator. The same seed always gives the same numbers.
export function seededRandom(seed: Uint8Array): Random {
  const word = (i: number) => ((seed[i] << 24) | (seed[i + 1] << 16) | (seed[i + 2] << 8) | seed[i + 3]) >>> 0;
  let a = word(0), b = word(4), c = word(8), d = word(12);
  const next = () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    const t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    const result = (t + d) | 0;
    c = (c + result) | 0;
    return (result >>> 0) / 4294967296;
  };
  // Mix the state well before using it.
  for (let i = 0; i < 15; i++) next();
  return next;
}
