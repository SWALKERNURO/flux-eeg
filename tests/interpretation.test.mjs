import test from "node:test";
import assert from "node:assert/strict";
import { buildInterpretation, buildInterpretationNote } from "../src/interpretation.js";

test("interpretation separates observation from conceptual prompts", () => {
  const result = { exponent: 1.8, r2: 0.96, alphaCF: 10.2, alphaPW: 1.1 };
  const interpretation = buildInterpretation({ result, dynamicsSummary: { reliableCount: 12, minimum: 1.5, maximum: 2.0 } });
  assert.equal(interpretation.ready, true);
  assert.match(interpretation.observation, /aperiodic exponent/);
  assert.match(interpretation.cautiousNeuroscience, /do not by themselves identify/);
  assert.equal(interpretation.lenses.map(lens => lens.title).join(","), "Flow,Fold,Field");
  assert.match(buildInterpretationNote({ interpretation, recordingName: "demo.csv", selectionLabel: "Eyes closed" }), /BOUNDARY/);
});
test("weak fits block substantive interpretation", () => {
  const interpretation = buildInterpretation({ result: { exponent: 1.2, r2: 0.5, alphaCF: 10, alphaPW: 0.5 } });
  assert.match(interpretation.cautiousNeuroscience, /warning takes priority/);
  assert.equal(interpretation.lenses.find(lens => lens.id === "fold").evidence, "limited");
});
