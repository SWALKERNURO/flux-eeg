import test from "node:test";
import assert from "node:assert/strict";
import {
  buildExperimentConditions,
  buildExperimentCsv,
  buildExperimentMarkers,
  buildExperimentRecording,
  createDefaultProtocol,
  createExperimentRun,
  createQuickDemoProtocol,
  phaseAtElapsed,
  protocolDuration,
} from "../src/experiment.js";

test("protocol timeline resolves phases and analysis intervals", () => {
  const protocol = createDefaultProtocol();
  assert.equal(protocolDuration(protocol), 140);
  assert.equal(phaseAtElapsed(protocol, 0).name, "Settle");
  assert.equal(phaseAtElapsed(protocol, 10).name, "Eyes open");
  assert.deepEqual(buildExperimentConditions(protocol).map(item => item.name), ["Eyes open", "Eyes closed"]);
  assert.equal(buildExperimentMarkers(protocol).length, 4);
});

test("quick protocol completes into a portable posterior recording", () => {
  const protocol = createQuickDemoProtocol();
  const run = createExperimentRun({ protocol, participantId: "P09", sessionId: "Rest 02", source: "demo" });
  const count = protocolDuration(protocol) * 250;
  const channel7 = Array.from({ length: count }, (_, index) => Math.sin(index / 10));
  const channel8 = Array.from({ length: count }, (_, index) => Math.cos(index / 10));
  const completed = buildExperimentRecording({ run, channel7, channel8 });
  assert.equal(completed.run.status, "complete");
  assert.equal(completed.run.recording.channels.O1.length, count);
  assert.equal(completed.conditions.length, 2);
  assert.match(buildExperimentCsv(completed.run), /sample,time_s,O1_uV,O2_uV,marker/);
  assert.match(buildExperimentCsv(completed.run), /Eyes open/);
});

test("early stop clips conditions to recorded duration", () => {
  const protocol = createDefaultProtocol();
  const run = createExperimentRun({ protocol, participantId: "P01", sessionId: "Rest 01", source: "serial" });
  const count = 25 * 250;
  const completed = buildExperimentRecording({ run, channel7: new Array(count).fill(0), channel8: new Array(count).fill(0), stoppedEarly: true });
  assert.equal(completed.run.stoppedEarly, true);
  assert.equal(completed.conditions.length, 1);
  assert.equal(completed.conditions[0].name, "Eyes open");
  assert.equal(completed.conditions[0].end, 25);
});
