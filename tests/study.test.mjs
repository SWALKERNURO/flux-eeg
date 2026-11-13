import test from "node:test";
import assert from "node:assert/strict";
import { addStudyRecord, buildStudyCsv, createDemoStudy, createEmptyStudy, summarizeStudy } from "../src/study.js";

test("study records support repeated sessions and participant-level pairing", () => {
  let study = createEmptyStudy("Pilot");
  for (const [sessionId, shift] of [["S1", 0], ["S2", 0.1]]) study = addStudyRecord(study, { participantId: "P01", sessionId, conditionResults: { A: { exponent: 1 + shift }, B: { exponent: 1.4 + shift } } });
  study = addStudyRecord(study, { participantId: "P02", conditionResults: { A: { exponent: 1.2 }, B: { exponent: 1.5 } } });
  const summary = summarizeStudy(study, "A", "B");
  assert.equal(summary.pairedCount, 2);
  assert.ok(Math.abs(summary.meanDifference - 0.35) < 1e-9);
  assert.ok(summary.dz > 0);
});
test("demo study produces paired group output and CSV rows", () => {
  const study = createDemoStudy();
  const summary = summarizeStudy(study, "Eyes open", "Eyes closed");
  assert.equal(summary.participants, 8);
  assert.equal(summary.pairedCount, 8);
  assert.ok(summary.meanDifference > 0.2);
  assert.match(buildStudyCsv(study), /P01,Rest 01,P01_rest\.csv,Eyes open/);
});
