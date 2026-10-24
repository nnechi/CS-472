// Options for a Parsons problem, with the generator's names and defaults.
//
// Only the line based grader runs here. The other graders in js-parsons run
// the student's Python in the browser, which this app doesn't do yet.

export interface ParsonsOptions {
  grader: "line-based";
  maxWrongLines: number; // extra lines a student is given, picked at random (generator: Max Distractors)
  canIndent: boolean; // false turns indentation off (generator: Disable indentation)
  xIndent: number; // pixels per indent level (generator: Indent Size)
  requireDragging: boolean; // extra lines start in a trash area and must be dragged out
  showFeedback: boolean; // whether students see the feedback messages
  execLimit: number; // milliseconds for graders that run code; not used by the line based grader
}

export const DEFAULT_PARSONS_OPTIONS: ParsonsOptions = {
  grader: "line-based",
  maxWrongLines: 10,
  canIndent: true,
  xIndent: 50,
  requireDragging: false,
  showFeedback: true,
  execLimit: 2500,
};

type ParseOptionsResult = { ok: true; value: ParsonsOptions } | { ok: false; error: string };

const isWholeNumberIn = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

// Reads the options a teacher set, filling in the generator's defaults for any
// that are missing. Dragging is switched on when there are extra lines, as the
// generator does, since the extra lines can't be solved without it.
export function parseParsonsOptions(input: unknown, hasExtraLines: boolean): ParseOptionsResult {
  const raw = (input ?? {}) as Record<string, unknown>;
  const value: ParsonsOptions = { ...DEFAULT_PARSONS_OPTIONS };

  if (raw.grader !== undefined && raw.grader !== "line-based") {
    return { ok: false, error: "That grader needs Python to run in the browser, which isn't supported yet." };
  }
  if (raw.maxWrongLines !== undefined) {
    if (!isWholeNumberIn(raw.maxWrongLines, 0, 60)) return { ok: false, error: "Max extra lines must be a whole number from 0 to 60." };
    value.maxWrongLines = raw.maxWrongLines;
  }
  if (raw.canIndent !== undefined) {
    if (typeof raw.canIndent !== "boolean") return { ok: false, error: "Indentation must be on or off." };
    value.canIndent = raw.canIndent;
  }
  if (raw.xIndent !== undefined) {
    if (!isWholeNumberIn(raw.xIndent, 1, 500)) return { ok: false, error: "Indent size must be a whole number from 1 to 500." };
    value.xIndent = raw.xIndent;
  }
  if (raw.requireDragging !== undefined) {
    if (typeof raw.requireDragging !== "boolean") return { ok: false, error: "Require dragging must be on or off." };
    value.requireDragging = raw.requireDragging;
  }
  if (raw.showFeedback !== undefined) {
    if (typeof raw.showFeedback !== "boolean") return { ok: false, error: "Show feedback must be on or off." };
    value.showFeedback = raw.showFeedback;
  }
  if (raw.execLimit !== undefined) {
    if (!isWholeNumberIn(raw.execLimit, 100, 60000)) return { ok: false, error: "Execution limit must be a whole number from 100 to 60000." };
    value.execLimit = raw.execLimit;
  }

  if (hasExtraLines && value.maxWrongLines > 0) value.requireDragging = true;
  return { ok: true, value };
}
