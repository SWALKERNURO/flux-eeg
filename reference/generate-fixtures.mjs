import { mkdir, writeFile } from "node:fs/promises";
import { analyzeSignal, DEFAULT_SETTINGS } from "../src/analysis.js";

const rate = 250;
const noise = (i, seed) => {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
};
const makeSignal = ({ seconds, exponent, alphaHz, alphaAmplitude, seed }) =>
  Array.from({ length: rate * seconds }, (_, i) => {
    const t = i / rate;
    let value = 0;
    for (let bin = 1; bin <= 180; bin++) {
      const f = bin * 0.25;
      value += 12 / f ** (exponent / 2) * Math.sin(2 * Math.PI * f * t + noise(bin, seed) * Math.PI);
    }
    return value + alphaAmplitude * Math.sin(2 * Math.PI * alphaHz * t) + noise(i, seed) * 2;
  });

const definitions = [
  { id: "posterior_alpha", seconds: 32, exponent: 1.8, alphaHz: 10.25, alphaAmplitude: 24, seed: 4 },
  { id: "weak_alpha", seconds: 32, exponent: 1.35, alphaHz: 9.5, alphaAmplitude: 7, seed: 9 },
  { id: "short_window", seconds: 8, exponent: 2.05, alphaHz: 11, alphaAmplitude: 14, seed: 12 },
];
const fixtures = definitions.map(definition => {
  const signal = makeSignal(definition);
  const flux = analyzeSignal(signal, rate, DEFAULT_SETTINGS);
  return { definition, sampleRate: rate, signal, flux: {
    freq: flux.freq, psd: flux.psd, exponent: flux.exponent, offset: flux.offset,
    r2: flux.r2, error: flux.error, alphaCF: flux.alphaCF, alphaPW: flux.alphaPW,
    alphaBW: flux.alphaBW, peaks: flux.peaks, nperseg: flux.nperseg,
    segments: flux.segments, resolution: flux.resolution,
  }};
});
await mkdir(new URL("./artifacts/", import.meta.url), { recursive: true });
await writeFile(new URL("./artifacts/fixtures.json", import.meta.url), JSON.stringify({ settings: DEFAULT_SETTINGS, fixtures }));
console.log(`Wrote ${fixtures.length} deterministic fixtures.`);
