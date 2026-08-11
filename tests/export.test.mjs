import test from "node:test";
import assert from "node:assert/strict";
import { buildManifest, buildResultsCsv } from "../src/export.js";

const conditions = [
  { id: "open", name: "Eyes open", start: 0, end: 60 },
  { id: "closed", name: "Eyes closed", start: 60, end: 180 },
];
const result = { exponent: 1.8, offset: 0.4, r2: 0.98, error: 0.03, alphaCF: 10.2, alphaPW: 2.4, alphaBW: 1.1, warnings: [], cleanIntervals: [[0, 60]] };

test("CSV export includes only analyzed conditions and all reported metrics", () => {
  const csv = buildResultsCsv(conditions, { open: result });
  assert.match(csv, /^condition,start_s,end_s,exponent,offset,r2,rmse,alpha_cf_hz,alpha_pw,alpha_bw_hz/);
  assert.match(csv, /Eyes open,0,60,1.8,0.4,0.98,0.03,10.2,2.4,1.1/);
  assert.doesNotMatch(csv, /Eyes closed/);
});

test("manifest export preserves provenance, exclusions, and clean intervals", () => {
  const manifest = buildManifest({
    recording: { name: "demo.csv", rate: 250 },
    selected: ["O1", "O2"],
    conditions,
    artifacts: [{ start: 12, end: 14 }],
    settings: { fmin: 1, fmax: 45 },
    conditionResults: { open: result },
    duration: 240,
  });
  assert.equal(manifest.schema, "flux-eeg-analysis-manifest/v0.2");
  assert.equal(manifest.validation.status, "passed");
  assert.deepEqual(manifest.artifactExclusions, [{ start: 12, end: 14 }]);
  assert.deepEqual(manifest.results.open.cleanIntervals, [[0, 60]]);
});
