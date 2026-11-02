import {
  ACTIVITY_MAX_LENGTH,
  ACTIVITY_MAX_QUESTIONS,
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_TYPES,
  ActivityType,
  PARSONS_MAX_LINES,
  PROGRAMMING_LANGUAGES,
} from "./types";
import { buildInitial, parseInitial } from "./parsons/parse";
import { ParsonsOptions, parseParsonsOptions } from "./parsons/options";

// One question as it is saved. Coding questions have an output. Parsons
// questions have the problem text (initial) and its options.
export interface SavedQuestion {
  question: string;
  output: string;
  initial: string;
  options: Partial<ParsonsOptions>;
}

export interface ActivityInput {
  teacherId: string;
  name: string;
  type: ActivityType;
  language: string | null;
  questions: SavedQuestion[];
}

type ParseResult = { ok: true; value: ActivityInput } | { ok: false; error: string };

// Checks a request to create an activity. Returns the cleaned values to save,
// or the reason to show the teacher.
export function parseActivityInput(body: unknown): ParseResult {
  const input = (body ?? {}) as Record<string, unknown>;
  const teacherId = typeof input.teacherId === "string" ? input.teacherId.trim() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const type = input.type;
  const language = input.language;
  const questions = input.questions;

  if (!teacherId) return { ok: false, error: "Missing teacher id." };
  if (!name) return { ok: false, error: "Give the activity a name." };
  if (name.length > ACTIVITY_NAME_MAX_LENGTH) {
    return { ok: false, error: `Activity names can be at most ${ACTIVITY_NAME_MAX_LENGTH} characters.` };
  }
  if (typeof type !== "string" || !(ACTIVITY_TYPES as readonly string[]).includes(type)) {
    return { ok: false, error: "Choose an activity type." };
  }
  if (type === "coding" && (typeof language !== "string" || !(PROGRAMMING_LANGUAGES as readonly string[]).includes(language))) {
    return { ok: false, error: "Choose a programming language." };
  }
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: "Add at least one question." };
  }
  if (questions.length > ACTIVITY_MAX_QUESTIONS) {
    return { ok: false, error: `An activity can have at most ${ACTIVITY_MAX_QUESTIONS} questions.` };
  }

  const saved: SavedQuestion[] = [];
  for (const item of questions) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    if (!question) return { ok: false, error: "Every question needs text." };
    if (question.length > ACTIVITY_MAX_LENGTH) {
      return { ok: false, error: `Questions can be at most ${ACTIVITY_MAX_LENGTH} characters.` };
    }

    if (type === "coding") {
      const output = typeof item.output === "string" ? item.output : "";
      if (!output) return { ok: false, error: "Every question needs a correct output." };
      if (output.length > ACTIVITY_MAX_LENGTH) {
        return { ok: false, error: `Outputs can be at most ${ACTIVITY_MAX_LENGTH} characters.` };
      }
      saved.push({ question, output, initial: "", options: {} });
      continue;
    }

    const parsed = checkParsonsQuestion(item);
    if (!parsed.ok) return parsed;
    saved.push({ question, output: "", initial: parsed.initial, options: parsed.options });
  }

  return {
    ok: true,
    value: {
      teacherId,
      name,
      type: type as ActivityType,
      language: type === "coding" ? (language as string) : null,
      questions: saved,
    },
  };
}

type ParsonsCheck = { ok: true; initial: string; options: Partial<ParsonsOptions> } | { ok: false; error: string };

// Checks one Parsons question: the code and extra lines become one problem
// text, which must parse, have at least one line to solve, stay within the
// line limit, and have valid options.
function checkParsonsQuestion(item: { code?: unknown; distractors?: unknown; options?: unknown }): ParsonsCheck {
  const code = typeof item.code === "string" ? item.code : "";
  const distractors = typeof item.distractors === "string" ? item.distractors : "";
  if (!code.trim()) return { ok: false, error: "Every Parsons question needs code." };
  if (code.length + distractors.length > ACTIVITY_MAX_LENGTH * PARSONS_MAX_LINES) {
    return { ok: false, error: "The code for a Parsons question is too long." };
  }
  const initial = buildInitial(code, distractors);

  const problem = parseInitial(initial);
  if (problem.errors.length > 0) return { ok: false, error: problem.errors[0] };
  if (problem.solution.length === 0) return { ok: false, error: "Every Parsons question needs at least one line of code." };
  if (problem.solution.length + problem.distractors.length > PARSONS_MAX_LINES) {
    return { ok: false, error: `A Parsons question can have at most ${PARSONS_MAX_LINES} lines.` };
  }

  const options = parseParsonsOptions(item.options, problem.distractors.length > 0);
  if (!options.ok) return { ok: false, error: options.error };
  // With indentation off the student can't indent, so indented code can't be solved.
  if (!options.value.canIndent && problem.solution.some((line) => line.indent > 0)) {
    return { ok: false, error: "This code is indented, so turn indentation on for it to be solvable." };
  }
  return { ok: true, initial, options: options.value };
}
