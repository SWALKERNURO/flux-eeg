import test from "node:test";
import assert from "node:assert/strict";
import { buildHtmlReport, buildManifest, buildMethodsSummary, buildResultsCsv } from "../src/export.js";

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
    dynamicsSettings: { windowSec: 8, stepSec: 4 },
    dynamic: [{ t: 4, v: 1.7, r2: 0.95 }],
    conditionResults: { open: result },
    duration: 240,
  });
  assert.equal(manifest.schema, "flux-eeg-analysis-manifest/v0.4");
  assert.equal(manifest.validation.status, "passed");
  assert.deepEqual(manifest.artifactExclusions, [{ start: 12, end: 14 }]);
  assert.deepEqual(manifest.results.open.cleanIntervals, [[0, 60]]);
  assert.equal(manifest.dynamics.points[0].v, 1.7);
});

test("methods export records preprocessing and reference validation", () => {
  const methods = buildMethodsSummary({
    recording: { name: "demo.csv", rate: 250 }, selected: ["O1", "O2"], conditions, artifacts: [], duration: 240,
    preprocessing: { detrend: true, notchHz: 60, highpassHz: 0.5, lowpassHz: 70, reference: "none" },
  });
  assert.match(methods, /linear detrending/);
  assert.match(methods, /0\.5–70 Hz zero-phase biquad filter/);
  assert.match(methods, /specparam 2\.0\.0rc7/);
});

test("HTML report escapes source content and includes analyzed conditions", () => {
  const report = buildHtmlReport({
    recording: { name: "<demo>.csv", rate: 250 },
    selected: ["O1", "O2"],
    conditions,
    artifacts: [],
    conditionResults: { open: result },
    duration: 240,
  });
  assert.match(report, /&lt;demo&gt;\.csv/);
  assert.match(report, /Eyes open/);
  assert.doesNotMatch(report, /<demo>/);
});
