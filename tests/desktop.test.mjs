import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import security from "../desktop/security.cjs";

test("desktop shell trusts only its packaged application origin", () => {
  assert.equal(security.isTrustedAppUrl("flux-eeg://app/"), true);
  assert.equal(security.isTrustedAppUrl("flux-eeg://other/"), false);
  assert.equal(security.isTrustedAppUrl("https://app/"), false);
  assert.equal(security.isTrustedAppUrl("not a url"), false);
});

test("desktop asset resolver keeps requests inside the packaged bundle", () => {
  const root = path.resolve("dist", "client");
  assert.equal(security.resolveBundlePath(root, "flux-eeg://app/"), path.join(root, "index.html"));
  assert.equal(security.resolveBundlePath(root, "flux-eeg://app/assets/main.js"), path.join(root, "assets", "main.js"));
  assert.equal(security.resolveBundlePath(root, "flux-eeg://other/assets/main.js"), null);
  assert.equal(security.resolveBundlePath(root, "flux-eeg://app/%5c..%5csecret.txt"), null);
});
