export const DEFAULT_PREPROCESSING = Object.freeze({
  detrend: true,
  notchHz: 60,
  highpassHz: 0.5,
  lowpassHz: 70,
  reference: "none",
  amplitudeThresholdUv: 180,
  stepThresholdUv: 75,
});

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function standardDeviation(values) {
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / Math.max(1, values.length));
}

export function detrendSignal(values) {
  if (values.length < 2) return [...values];
  const n = values.length;
  const meanX = (n - 1) / 2;
  const meanY = mean(values);
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < n; index += 1) {
    numerator += (index - meanX) * (values[index] - meanY);
    denominator += (index - meanX) ** 2;
  }
  const slope = numerator / Math.max(1, denominator);
  const intercept = meanY - slope * meanX;
  return values.map((value, index) => value - (intercept + slope * index));
}

function normalizedBiquad({ b0, b1, b2, a0, a1, a2 }) {
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

function lowpassCoefficients(rate, cutoff, q = Math.SQRT1_2) {
  const omega = 2 * Math.PI * cutoff / rate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * q);
  return normalizedBiquad({ b0: (1 - cosine) / 2, b1: 1 - cosine, b2: (1 - cosine) / 2, a0: 1 + alpha, a1: -2 * cosine, a2: 1 - alpha });
}

function highpassCoefficients(rate, cutoff, q = Math.SQRT1_2) {
  const omega = 2 * Math.PI * cutoff / rate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * q);
  return normalizedBiquad({ b0: (1 + cosine) / 2, b1: -(1 + cosine), b2: (1 + cosine) / 2, a0: 1 + alpha, a1: -2 * cosine, a2: 1 - alpha });
}

function notchCoefficients(rate, frequency, q = 30) {
  const omega = 2 * Math.PI * frequency / rate;
  const cosine = Math.cos(omega);
  const alpha = Math.sin(omega) / (2 * q);
  return normalizedBiquad({ b0: 1, b1: -2 * cosine, b2: 1, a0: 1 + alpha, a1: -2 * cosine, a2: 1 - alpha });
}

function applyBiquad(values, coefficients) {
  const output = new Array(values.length);
  let x1 = values[0] || 0;
  let x2 = x1;
  let y1 = x1;
  let y2 = x1;
  for (let index = 0; index < values.length; index += 1) {
    const x0 = values[index];
    const y0 = coefficients.b0 * x0 + coefficients.b1 * x1 + coefficients.b2 * x2 - coefficients.a1 * y1 - coefficients.a2 * y2;
    output[index] = Number.isFinite(y0) ? y0 : 0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }
  return output;
}

function zeroPhase(values, coefficients) {
  const forward = applyBiquad(values, coefficients);
  return applyBiquad([...forward].reverse(), coefficients).reverse();
}

export function preprocessSignal(values, rate, settings = DEFAULT_PREPROCESSING) {
  let output = settings.detrend ? detrendSignal(values) : [...values];
  const nyquist = rate / 2;
  if (settings.notchHz > 0 && settings.notchHz < nyquist * 0.98) output = zeroPhase(output, notchCoefficients(rate, settings.notchHz));
  if (settings.highpassHz > 0 && settings.highpassHz < nyquist * 0.98) output = zeroPhase(output, highpassCoefficients(rate, settings.highpassHz));
  if (settings.lowpassHz > 0 && settings.lowpassHz < nyquist * 0.98) output = zeroPhase(output, lowpassCoefficients(rate, settings.lowpassHz));
  return output;
}

export function preprocessChannels(channels, rate, settings = DEFAULT_PREPROCESSING) {
  const names = Object.keys(channels);
  const processed = Object.fromEntries(names.map(name => [name, preprocessSignal(channels[name], rate, settings)]));
  const warnings = [];
  if (settings.reference === "common-average") {
    if (names.length < 3) {
      warnings.push("Common-average reference was not applied because fewer than three EEG channels are available.");
    } else {
      const length = Math.min(...names.map(name => processed[name].length));
      for (let index = 0; index < length; index += 1) {
        const reference = names.reduce((sum, name) => sum + processed[name][index], 0) / names.length;
        names.forEach(name => { processed[name][index] -= reference; });
      }
    }
  }
  return { channels: processed, warnings };
}

function percentile(values, quantile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * quantile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

export function assessChannelQuality(channels, rate, settings = DEFAULT_PREPROCESSING) {
  return Object.entries(channels).map(([name, values]) => {
    const deviation = standardDeviation(values);
    const absolute = values.map(Math.abs);
    const differences = values.slice(1).map((value, index) => Math.abs(value - values[index]));
    const extremeShare = absolute.filter(value => value >= settings.amplitudeThresholdUv).length / Math.max(1, values.length);
    const flatShare = differences.filter(value => value < 1e-6).length / Math.max(1, differences.length);
    const first = mean(values.slice(0, Math.max(1, Math.floor(values.length / 4))));
    const last = mean(values.slice(-Math.max(1, Math.floor(values.length / 4))));
    const driftRatio = Math.abs(last - first) / Math.max(0.001, deviation);
    const reasons = [];
    if (deviation < 0.25) reasons.push("nearly flat");
    if (flatShare > 0.2) reasons.push("repeated samples");
    if (extremeShare > 0.01) reasons.push("frequent extreme amplitude");
    if (driftRatio > 2.5) reasons.push("strong slow drift");
    const status = reasons.length >= 2 || deviation < 0.1 ? "bad" : reasons.length ? "review" : "good";
    return { name, status, reasons, standardDeviation: deviation, p99Amplitude: percentile(absolute, 0.99), extremeShare, flatShare, driftRatio, sampleRate: rate };
  });
}

export function detectArtifactIntervals(channels, selected, rate, settings = DEFAULT_PREPROCESSING) {
  const names = selected.filter(name => channels[name]);
  if (!names.length) return [];
  const length = Math.min(...names.map(name => channels[name].length));
  const windowSamples = Math.max(1, Math.round(rate * 0.5));
  const flagged = [];
  for (let start = 0; start < length; start += windowSamples) {
    const end = Math.min(length, start + windowSamples);
    let shouldFlag = false;
    for (const name of names) {
      const values = channels[name];
      let maximum = 0;
      let maximumStep = 0;
      for (let index = start; index < end; index += 1) {
        maximum = Math.max(maximum, Math.abs(values[index] || 0));
        if (index > start) maximumStep = Math.max(maximumStep, Math.abs((values[index] || 0) - (values[index - 1] || 0)));
      }
      if (maximum >= settings.amplitudeThresholdUv || maximumStep >= settings.stepThresholdUv) {
        shouldFlag = true;
        break;
      }
    }
    if (shouldFlag) flagged.push({ start: Math.max(0, start / rate - 0.25), end: Math.min(length / rate, end / rate + 0.25) });
  }
  const merged = [];
  flagged.forEach(interval => {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end + 0.25) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  });
  return merged.map((interval, index) => ({ id: `suggested-artifact-${index}`, ...interval, source: "automatic suggestion" }));
}

export function summarizeQuality(quality) {
  const bad = quality.filter(channel => channel.status === "bad").length;
  const review = quality.filter(channel => channel.status === "review").length;
  return { bad, review, good: quality.length - bad - review, status: bad ? "review" : review ? "caution" : "good" };
}
