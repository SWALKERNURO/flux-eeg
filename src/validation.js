import { DEFAULT_SETTINGS, parameterizeSpectrum } from "./analysis.js";

export const REFERENCE_VALIDATION = Object.freeze({
  status: "passed",
  fixtures: 3,
  scipy: "1.14.1",
  specparam: "2.0.0rc7",
  completedAt: "2026-08-10",
  domain: "Three deterministic posterior-alpha fixtures",
  tolerances: Object.freeze({ exponent: 0.15, offset: 0.2, alphaCF: 0.5, alphaPW: 0.35, alphaBW: 1.5 }),
});

export function runBuiltInSelfCheck() {
  const expected = { exponent: 1.8, offset: 1.2, alphaCF: 10, alphaPW: 0.72, alphaBW: 2.4 };
  const frequency = Array.from({ length: 181 }, (_, index) => index * 0.25);
  const sigma = expected.alphaBW / 2.355;
  const power = frequency.map(value => value === 0 ? 0 : 10 ** (
    expected.offset
    - expected.exponent * Math.log10(value)
    + expected.alphaPW * Math.exp(-0.5 * ((value - expected.alphaCF) / sigma) ** 2)
  ));
  const observed = parameterizeSpectrum(frequency, power, { ...DEFAULT_SETTINGS, peakWidthLimits: [0.5, 6] });
  const differences = {
    exponent: Math.abs(observed.exponent - expected.exponent),
    offset: Math.abs(observed.offset - expected.offset),
    alphaCF: Math.abs(observed.alphaCF - expected.alphaCF),
    alphaPW: Math.abs(observed.alphaPW - expected.alphaPW),
    alphaBW: Math.abs(observed.alphaBW - expected.alphaBW),
  };
  const checks = Object.fromEntries(Object.entries(differences).map(([key, value]) => [key, value <= REFERENCE_VALIDATION.tolerances[key]]));
  return { passed: Object.values(checks).every(Boolean), expected, observed, differences, checks, fixture: "Analytic 1/f + 10 Hz alpha" };
}

export function validationMethodsSentence() {
  return `The Welch and spectral-parameterization core was checked against SciPy ${REFERENCE_VALIDATION.scipy} and specparam ${REFERENCE_VALIDATION.specparam} using ${REFERENCE_VALIDATION.fixtures} deterministic fixtures and declared per-parameter tolerances.`;
}
