import test from "node:test";
import assert from "node:assert/strict";
import { detectTransitions, summarizeDynamics } from "../src/dynamics.js";

const points = [
  { t: 4, v: 1.5, r2: 0.96 },
  { t: 8, v: 1.54, r2: 0.95 },
  { t: 12, v: 1.72, r2: 0.94 },
  { t: 16, v: 1.68, r2: 0.93 },
];

test("transition detection reports direction and fit quality", () => {
  const transitions = detectTransitions(points, 0.08);
  assert.equal(transitions.length, 1);
  assert.equal(transitions[0].time, 12);
  assert.equal(transitions[0].direction, "steepening");
  assert.equal(transitions[0].quality, 0.94);
});

test("dynamics summary reports range and stable share", () => {
  const summary = summarizeDynamics(points, 0.08);
  assert.equal(summary.minimum, 1.5);
  assert.equal(summary.maximum, 1.72);
  assert.equal(summary.stableShare, 2 / 3);
  assert.equal(summary.reliableCount, 4);
});

test("weak fits never produce transition claims", () => {
  const weak = points.map(point => ({ ...point, r2: 0.7 }));
  assert.deepEqual(detectTransitions(weak, 0.01), []);
  assert.equal(summarizeDynamics(weak, 0.01).reliableCount, 0);
});
