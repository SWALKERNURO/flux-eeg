import test from "node:test";
import assert from "node:assert/strict";
import { cleanIntervals, DEFAULT_SETTINGS, parameterizeSpectrum, welchPsd } from "../src/analysis.js";

test("Welch PSD preserves a known sinusoid frequency", () => {
  const rate = 250, seconds = 16, signal = Array.from({length:rate*seconds}, (_,i) => 3*Math.sin(2*Math.PI*10*i/rate));
  const result = welchPsd(signal, rate);
  const peak = result.freq.slice(1).reduce((best,f,i) => result.psd[i+1] > result.psd[best] ? i+1 : best, 1);
  assert.ok(Math.abs(result.freq[peak] - 10) <= result.resolution);
  assert.equal(result.nperseg, 1024);
  assert.ok(result.segments >= 6);
});

test("fixed-mode fixture recovers exponent and alpha peak", () => {
  const freq = Array.from({length:181}, (_,i) => .25*i);
  const exponent = 1.8, offset = 1.2, center = 10, bandwidth = 2.4, sigma = bandwidth/2.355;
  const psd = freq.map(f => f === 0 ? 0 : 10 ** (offset - exponent*Math.log10(f) + .72*Math.exp(-.5*((f-center)/sigma)**2)));
  const fit = parameterizeSpectrum(freq, psd, {...DEFAULT_SETTINGS, peakWidthLimits:[.5,6]});
  assert.ok(Math.abs(fit.exponent - exponent) < .08, `exponent ${fit.exponent}`);
  assert.ok(Math.abs(fit.alphaCF - center) < .4, `alpha CF ${fit.alphaCF}`);
  assert.ok(Math.abs(fit.alphaBW - bandwidth) < 1.0, `alpha BW ${fit.alphaBW}`);
  assert.ok(fit.r2 > .98, `R² ${fit.r2}`);
});

test("poor fits surface a warning instead of being silently trusted", () => {
  const freq = Array.from({length:181}, (_,i) => .25*i);
  const psd = freq.map(f => f === 0 ? 0 : 10 ** (1 - 1.5*Math.log10(f) + .3*Math.sin(f*2.7)));
  const fit = parameterizeSpectrum(freq, psd, DEFAULT_SETTINGS);
  assert.ok(fit.warnings.some(w => w.includes("R²")));
});

test("artifact intervals split a condition without leaking excluded samples", () => {
  assert.deepEqual(cleanIntervals([0, 60], [{start:20,end:30}]), [[0,20],[30,60]]);
  assert.deepEqual(cleanIntervals([10, 50], [{start:0,end:15},{start:45,end:70}]), [[15,45]]);
});

test("artifact fragments shorter than one analysis window are rejected", () => {
  assert.deepEqual(cleanIntervals([0, 10], [{start:3,end:7}]), []);
});
