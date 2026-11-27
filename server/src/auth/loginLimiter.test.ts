import { test } from "node:test";
import assert from "node:assert/strict";
import { createFailureLimiter } from "./loginLimiter";

test("blocks a key after too many failures and reports when it may retry", () => {
    const limiter = createFailureLimiter(3, 1000);
    limiter.fail("k", 0);
    limiter.fail("k", 100);
    assert.equal(limiter.retryAfterMs("k", 200), 0);
    limiter.fail("k", 200);
    assert.equal(limiter.retryAfterMs("k", 300), 700);
    assert.equal(limiter.retryAfterMs("other", 300), 0);
});

test("failures age out of the window", () => {
    const limiter = createFailureLimiter(2, 1000);
    limiter.fail("k", 0);
    limiter.fail("k", 500);
    assert.equal(limiter.retryAfterMs("k", 999), 1);
    assert.equal(limiter.retryAfterMs("k", 1000), 0);
    limiter.fail("k", 1000);
    assert.equal(limiter.retryAfterMs("k", 1200), 300);
});

test("reset clears a key", () => {
    const limiter = createFailureLimiter(1, 1000);
    limiter.fail("k", 0);
    assert.ok(limiter.retryAfterMs("k", 1) > 0);
    limiter.reset("k");
    assert.equal(limiter.retryAfterMs("k", 1), 0);
});
