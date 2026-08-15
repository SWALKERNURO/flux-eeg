import test from "node:test";
import assert from "node:assert/strict";
import { REFERENCE_VALIDATION, runBuiltInSelfCheck } from "../src/validation.js";

test("built-in analytic fixture passes declared tolerances", () => {
  const check = runBuiltInSelfCheck();
  assert.equal(check.passed, true);
  assert.equal(REFERENCE_VALIDATION.status, "passed");
  assert.equal(Object.values(check.checks).every(Boolean), true);
});
