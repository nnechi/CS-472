import assert from "node:assert/strict";
import { test } from "node:test";
import { buildInitial, parseInitial, studentPool } from "./parse";

// Lines are written with String.raw so a backslash in them is a real backslash,
// exactly as a teacher would type it in the activity editor.
const OUTER = String.raw`cout << "Outer: " << i << "\n";  // Executes 2 times`;
const INNER = String.raw`cout << "Inner: " << j << "\n";  // Executes 6 times`;

test("an escape like backslash-n inside a line stays exactly as typed", () => {
  const { solution, errors } = parseInitial(buildInitial(OUTER, ""));
  assert.deepEqual(errors, []);
  assert.deepEqual(solution, [{ code: OUTER, indent: 0 }]);
});

test("other escape sequences are kept as typed", () => {
  const line = String.raw`printf("a\tb\c\"d\n\r\0");`;
  assert.equal(parseInitial(buildInitial(line, "")).solution[0].code, line);
});

test("an extra line keeps its backslash-n and loses only the #distractor tag", () => {
  const extra = String.raw`cout << "Inner: " << j << "\n";`;
  const { solution, distractors } = parseInitial(buildInitial("int x = 0;", extra));
  assert.deepEqual(solution, [{ code: "int x = 0;", indent: 0 }]);
  assert.deepEqual(distractors, [extra]);
});

test("nested loops keep their backslash-n and their indentation levels", () => {
  const code = [
    "for (int i = 0; i < 2; i++) {",
    `    ${OUTER}`,
    "    for (int j = 0; j < 3; j++) {",
    `        ${INNER}`,
    "    }",
    "}",
  ].join("\n");
  const { solution, errors } = parseInitial(buildInitial(code, ""));
  assert.deepEqual(errors, []);
  assert.deepEqual(solution.map((line) => line.indent), [0, 1, 1, 2, 1, 0]);
  assert.equal(solution[1].code, OUTER);
  assert.equal(solution[3].code, INNER);
});

test("the lines students get have no line breaks in them", () => {
  const code = ["int main() {", `    ${OUTER}`, "}"].join("\n");
  const { solution, distractors } = parseInitial(buildInitial(code, String.raw`puts("\n");`));
  const pool = studentPool(solution, distractors, 10);
  assert.equal(pool.length, 4);
  assert.ok(pool.includes(OUTER));
  for (const line of pool) assert.ok(!line.includes("\n"), `line break in ${JSON.stringify(line)}`);
});

test("lines are still trimmed and blank lines skipped", () => {
  const { solution } = parseInitial(buildInitial("  x = 1  \n\n   \ny = 2\t", ""));
  assert.deepEqual(solution.map((line) => line.code), ["x = 1", "y = 2"]);
});
