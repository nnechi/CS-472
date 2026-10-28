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
function codeOf(text: string): string {
  return text.replace(DISTRACTOR_SUFFIX, "").replace(/^\s*(.*?)\s*$/, "$1").replace(/\\n/g, "\n");
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

// Fisher-Yates shuffle. Used for the order of lines and for picking extra lines.
export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// The lines a student starts with: every solution line, plus up to maxWrongLines
// extra lines picked at random, all in a random order. Same as the widget's init
// and shuffleLines.
export function studentPool(solution: ParsonsLine[], distractors: string[], maxWrongLines: number): string[] {
  const picked = shuffle(distractors).slice(0, maxWrongLines);
  return shuffle([...solution.map((line) => line.code), ...picked]);
}
