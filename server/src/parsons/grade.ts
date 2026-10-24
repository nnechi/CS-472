// The line based grader, ported from js-parsons LineBasedGrader (parsons.js).
// It checks the lines are the right ones, in the right order, the right number
// of them, and then the indentation. Feedback wording is the library's English.

import { LineMark, ParsonsLine } from "../types";
import { normalizeIndents } from "./parse";
import { outOfOrderIndexes } from "./lis";

export interface GradeResult {
  success: boolean;
  errors: string[];
  marks: LineMark[];
}

const ORDER_MESSAGE =
  "Code fragments in your program are wrong, or in wrong order. This can be fixed by moving, removing, or replacing highlighted fragments.";
const TOO_FEW_MESSAGE = "Your program has too few code fragments.";
const TOO_MANY_MESSAGE = "Your program has too many code fragments.";
const indentMessage = (lineNumber: number) =>
  `The highlighted fragment ${lineNumber} belongs to a wrong block (i.e. indentation).`;

// Grades a student's answer against the solution. When canIndent is off, the
// widget keeps every line at level 0, so indentation is ignored.
export function gradeLineBased(solution: ParsonsLine[], answer: ParsonsLine[], canIndent: boolean): GradeResult {
  const student = normalizeIndents(answer.map((line) => ({ code: line.code, indent: canIndent ? line.indent : 0 })));
  const linesToCheck = Math.min(student.length, solution.length);
  const errors: string[] = [];
  const marks: LineMark[] = [];

  // Where each student line sits in the solution. The first match after the
  // last one used is taken, so repeated lines are matched in order.
  const lastFound = new Map<string, number>();
  const position: number[] = student.map(() => -1);
  const unknown: boolean[] = student.map(() => false);
  let wrongOrder = false;

  student.forEach((line, k) => {
    let i = lastFound.has(line.code) ? (lastFound.get(line.code) as number) + 1 : 0;
    for (; i < solution.length; i++) {
      if (solution[i].code === line.code) {
        lastFound.set(line.code, i);
        position[k] = i;
        break;
      }
    }
    if (i === solution.length) {
      if (!lastFound.has(line.code)) {
        // Not in the solution at all: an extra line.
        wrongOrder = true;
        unknown[k] = true;
        marks.push({ index: k, kind: "position" });
      } else {
        // Another copy of a solution line. Its place is the last one matched.
        position[k] = lastFound.get(line.code) as number;
      }
    }
  });

  // Lines that are in the solution but out of order.
  const known = student.map((_, k) => k).filter((k) => !unknown[k]);
  const outOfOrder = outOfOrderIndexes(known.map((k) => position[k]));
  for (const index of outOfOrder) marks.push({ index: known[index], kind: "position" });
  if (outOfOrder.length > 0) wrongOrder = true;

  if (wrongOrder) errors.push(ORDER_MESSAGE);

  if (solution.length < student.length) {
    errors.push(TOO_MANY_MESSAGE);
  } else if (solution.length > student.length) {
    errors.push(TOO_FEW_MESSAGE);
  }

  // Indentation is only checked once the lines themselves are right, and only
  // the first wrong line is reported.
  if (errors.length === 0) {
    for (let i = 0; i < linesToCheck; i++) {
      if (student[i].indent !== solution[i].indent && errors.length === 0) {
        marks.push({ index: i, kind: "indent" });
        errors.push(indentMessage(i + 1));
      }
    }
  }

  return { success: errors.length === 0, errors, marks };
}
