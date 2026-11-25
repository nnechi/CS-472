import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { buildInitial, parseInitial, poolLines, seededRandom, splitInitial, studentPool, studentPoolOrder } from "./parse";

// ---------------------------------------------------------------------------
// Reading a problem: lines are kept exactly as the teacher typed them.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Editing a saved problem: splitInitial reverses buildInitial so the editor
// can show the teacher their original code and extra lines back.
// ---------------------------------------------------------------------------

test("splitInitial reverses buildInitial for code with indentation and extra lines", () => {
  const code = ["for (int i = 0; i < 2; i++) {", `    ${OUTER}`, "}"].join("\n");
  const distractors = ["int y = 0;", "    int z = 1;"].join("\n");
  const { code: gotCode, distractors: gotDistractors } = splitInitial(buildInitial(code, distractors));
  assert.equal(gotCode, code);
  assert.equal(gotDistractors, distractors);
});

test("splitInitial with no extra lines gives back an empty distractors box", () => {
  const code = "print(1)\nprint(2)";
  const { code: gotCode, distractors } = splitInitial(buildInitial(code, ""));
  assert.equal(gotCode, code);
  assert.equal(distractors, "");
});

test("splitInitial keeps whitespace-only lines, but can't recover lines that were fully blank", () => {
  // buildInitial drops lines that are exactly "" when it saves; a line of only
  // spaces is not "", so it survives the round trip untouched.
  const code = "x = 1\n   \ny = 2";
  const { code: gotCode } = splitInitial(buildInitial(code, ""));
  assert.equal(gotCode, "x = 1\n   \ny = 2");

  const withBlank = "x = 1\n\ny = 2";
  const { code: gotWithBlank } = splitInitial(buildInitial(withBlank, ""));
  assert.equal(gotWithBlank, "x = 1\ny = 2");
});

test("splitInitial does not mistake a code line merely containing the word distractor for an extra line", () => {
  const code = String.raw`print("not a #distractor here")`;
  const { code: gotCode, distractors } = splitInitial(buildInitial(code, ""));
  assert.equal(gotCode, code);
  assert.equal(distractors, "");
});

test("a code line that itself ends in the literal #distractor tag reads back as an extra line, same ambiguity parseInitial already has", () => {
  const code = ["x = 1", "#distractor"].join("\n");
  const initial = buildInitial(code, "");
  const { code: gotCode, distractors } = splitInitial(initial);
  // splitInitial reads the second line as the tag, same as parseInitial does:
  // it isn't a new ambiguity, just one it agrees with the grader about.
  assert.equal(gotCode, "x = 1");
  assert.equal(distractors, "");
  assert.deepEqual(parseInitial(initial).solution, [{ code: "x = 1", indent: 0 }]);
});

// ---------------------------------------------------------------------------
// The lines each student is given: every solution line plus some extra lines,
// the same every time the same student joins.
// ---------------------------------------------------------------------------

const sorted = (values: number[]) => [...values].sort((a, b) => a - b);
const seed = (text: string) => createHash("sha256").update(text).digest();

test("a pool order has every solution line once and up to maxWrongLines extra lines", () => {
  for (let run = 0; run < 50; run++) {
    const order = studentPoolOrder(4, 5, 2);
    assert.equal(order.length, 6);
    assert.deepEqual(sorted(order.filter((p) => p < 4)), [0, 1, 2, 3]);
    const extra = order.filter((p) => p >= 4);
    assert.equal(extra.length, 2);
    assert.equal(new Set(extra).size, 2);
    assert.ok(extra.every((p) => p < 9));
  }
});

test("a pool order never asks for more extra lines than exist", () => {
  assert.deepEqual(sorted(studentPoolOrder(2, 1, 10)), [0, 1, 2]);
  assert.deepEqual(sorted(studentPoolOrder(3, 4, 0)), [0, 1, 2]);
});

test("poolLines turns an order back into the lines, solution first then extra lines", () => {
  const problem = parseInitial("a = 1\nb = 2\nx = 9 #distractor");
  assert.deepEqual(poolLines([2, 0, 1], problem.solution, problem.distractors), ["x = 9", "a = 1", "b = 2"]);
});

test("studentPool still gives every solution line plus picked extra lines", () => {
  const problem = parseInitial("a = 1\nb = 2\nx #distractor\ny #distractor");
  const pool = studentPool(problem.solution, problem.distractors, 1);
  assert.equal(pool.length, 3);
  assert.ok(pool.includes("a = 1") && pool.includes("b = 2"));
  assert.equal(pool.filter((line) => line === "x" || line === "y").length, 1);
});

test("the same seed gives the same pool, so a returning student gets the same lines", () => {
  const problem = parseInitial("a\nb\nc\nd\ne\nf\nx #distractor\ny #distractor\nz #distractor");
  const first = studentPool(problem.solution, problem.distractors, 2, seededRandom(seed("student-1")));
  const again = studentPool(problem.solution, problem.distractors, 2, seededRandom(seed("student-1")));
  assert.deepEqual(again, first);
});

test("different seeds give different pools", () => {
  const problem = parseInitial("a\nb\nc\nd\ne\nf\ng\nh");
  const pools = new Set<string>();
  for (let i = 0; i < 20; i++) {
    pools.add(studentPool(problem.solution, problem.distractors, 0, seededRandom(seed(`student-${i}`))).join("|"));
  }
  assert.ok(pools.size > 15, `only ${pools.size} different pools out of 20`);
});

test("seededRandom stays in [0, 1)", () => {
  const random = seededRandom(seed("range"));
  for (let i = 0; i < 1000; i++) {
    const value = random();
    assert.ok(value >= 0 && value < 1);
  }
});
