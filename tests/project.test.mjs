import test from "node:test";
import assert from "node:assert/strict";
import { buildProjectSnapshot, parseProjectSnapshot, PROJECT_SCHEMA } from "../src/project.js";

test("project snapshots round-trip recording and research annotations", () => {
  const state = {
    recording: { name: "demo.csv", rate: 250, channels: { O1: [1, 2], O2: [2, 3] } },
    selected: ["O1", "O2"],
    range: [4, 12],
    conditions: [{ id: "a", name: "A", start: 0, end: 10 }],
    artifacts: [{ id: "x", start: 4, end: 5 }],
    events: [{ id: "e", time: 6, label: "Start" }],
    annotations: [{ id: "n", time: 8, label: "Transition" }],
    dynamicsSettings: { windowSec: 8, stepSec: 4, transitionThreshold: 0.08 },
    preprocessing: { detrend: true, notchHz: 60, highpassHz: 0.5, lowpassHz: 70, reference: "none" },
    experimentProtocol: { schema: "flux-eeg-experiment/v0.8", name: "Rest", phases: [{ id: "open", name: "Eyes open", durationSec: 60, analyze: true }] },
    experimentRun: { status: "complete", participantId: "P01", sessionId: "S01" },
  };
  const parsed = parseProjectSnapshot(JSON.stringify(buildProjectSnapshot(state)));
  assert.equal(parsed.schema, PROJECT_SCHEMA);
  assert.deepEqual(parsed.recording.channels.O1, [1, 2]);
  assert.equal(parsed.annotations[0].label, "Transition");
  assert.equal(parsed.preprocessing.notchHz, 60);
  assert.equal(parsed.experimentProtocol.name, "Rest");
  assert.equal(parsed.experimentRun.participantId, "P01");
});

test("project parser rejects unrelated JSON", () => {
  assert.throws(() => parseProjectSnapshot('{"schema":"unknown"}'), /not a supported Flux EEG project/);
});
