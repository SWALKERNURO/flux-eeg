import { readFile, writeFile } from "node:fs/promises";
const root = new URL("./artifacts/", import.meta.url);
const fixtures = JSON.parse(await readFile(new URL("fixtures.json", root)));
const python = JSON.parse(await readFile(new URL("python-reference.json", root)));

const tolerances = {
  psdRelativeMax: 1e-7,
  exponentAbsolute: 0.15,
  offsetAbsolute: 0.2,
  alphaCFHz: 0.5,
  alphaPWLog10: 0.35,
  alphaBWHZ: 1.5,
};
const comparisons = fixtures.fixtures.map(fixture => {
  const reference = python.results.find(row => row.id === fixture.definition.id);
  const rel = fixture.flux.psd.map((value, i) => Math.abs(value - reference.scipy.psd[i]) / Math.max(Math.abs(reference.scipy.psd[i]), 1e-20));
  const checks = {
    psd: Math.max(...rel) <= tolerances.psdRelativeMax,
    exponent: Math.abs(fixture.flux.exponent - reference.specparam.exponent) <= tolerances.exponentAbsolute,
    offset: Math.abs(fixture.flux.offset - reference.specparam.offset) <= tolerances.offsetAbsolute,
    alphaCF: Math.abs(fixture.flux.alphaCF - reference.specparam.alphaCF) <= tolerances.alphaCFHz,
    alphaPW: Math.abs(fixture.flux.alphaPW - reference.specparam.alphaPW) <= tolerances.alphaPWLog10,
    alphaBW: Math.abs(fixture.flux.alphaBW - reference.specparam.alphaBW) <= tolerances.alphaBWHZ,
  };
  return { id: fixture.definition.id, passed: Object.values(checks).every(Boolean), checks, differences: {
    psdRelativeMax: Math.max(...rel),
    exponent: fixture.flux.exponent - reference.specparam.exponent,
    offset: fixture.flux.offset - reference.specparam.offset,
    alphaCF: fixture.flux.alphaCF - reference.specparam.alphaCF,
    alphaPW: fixture.flux.alphaPW - reference.specparam.alphaPW,
    alphaBW: fixture.flux.alphaBW - reference.specparam.alphaBW,
  }};
});
const report = { status: comparisons.every(row => row.passed) ? "passed" : "failed", tolerances, environment: python.environment, comparisons };
await writeFile(new URL("validation-report.json", root), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.status !== "passed") process.exitCode = 1;
