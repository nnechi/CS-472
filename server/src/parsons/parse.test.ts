import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseInitial, poolLines, seededRandom, studentPool, studentPoolOrder } from "./parse";

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
