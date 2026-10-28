import assert from "node:assert/strict";
import { test } from "node:test";
import { receiveCode } from "./submission";

test("acknowledges the language and UTF-8 size of received code", () => {
  assert.deepEqual(
    receiveCode({ language: "javascript", code: "console.log('✓')" }),
    { language: "javascript", bytes: Buffer.byteLength("console.log('✓')") }
  );
});

test("rejects empty, unsupported, and oversized submissions", () => {
  assert.throws(() => receiveCode({ language: "javascript", code: " " }), /non-empty/);
  assert.throws(() => receiveCode({ language: "python", code: "print(1)" }), /Only JavaScript/);
  assert.throws(
    () => receiveCode({ language: "typescript", code: "x".repeat(64 * 1024 + 1) }),
    /size limit/
  );
});
