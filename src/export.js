import { REFERENCE_VALIDATION, validationMethodsSentence } from "./validation.js";

export function buildManifest({ recording, selected, conditions, artifacts, events = [], annotations = [], dynamicsSettings = null, dynamic = [], settings, preprocessing, quality = [], conditionResults, duration }) {
  return {
    schema: "flux-eeg-analysis-manifest/v0.4",
    createdAt: new Date().toISOString(),
    source: { name: recording.name, sampleRate: recording.rate, duration, sha256: recording.sourceHash || "demo-generated" },
    channels: selected,
    conditions,
    artifactExclusions: artifacts,
    events,
    annotations,
    dynamics: { settings: dynamicsSettings, points: dynamic },
    preprocessing,
    channelQuality: quality,
    spectralSettings: settings,
    engine: "Flux spectral-fit 0.4",
    validation: REFERENCE_VALIDATION,
    results: Object.fromEntries(Object.entries(conditionResults).map(([id, result]) => [id, compactResult(result)])),
  };
}

function compactResult(result) {
  return {
    exponent: result.exponent,
    offset: result.offset,
    r2: result.r2,
    error: result.error,
    alphaCF: result.alphaCF,
    alphaPW: result.alphaPW,
    alphaBW: result.alphaBW,
    confidence: result.confidence,
    warnings: result.warnings,
    cleanIntervals: result.cleanIntervals,
  };
}

export function buildMethodsSummary({ recording, selected, conditions, artifacts, preprocessing = { detrend: true, notchHz: 60, highpassHz: 0.5, lowpassHz: 70, reference: "none" }, duration }) {
  const conditionText = conditions.length
    ? conditions.map(condition => `${condition.name} (${condition.start.toFixed(1)}–${condition.end.toFixed(1)} s)`).join(", ")
    : "the interactively selected interval";
  const reference = preprocessing.reference === "common-average" ? "common-average reference across all imported EEG channels" : "the imported reference";
  const notch = preprocessing.notchHz > 0 ? `${preprocessing.notchHz} Hz notch filtering` : "no notch filter";
  return `Flux EEG V0.4 methods summary

EEG data were imported from ${recording.name} at ${recording.rate} Hz (${duration.toFixed(1)} s total). Analyses used ${selected.join(" + ")} ${selected.length > 1 ? "averaged sample-by-sample" : "as a single channel"}. The preprocessing pipeline applied ${preprocessing.detrend ? "linear detrending" : "no detrending"}, ${notch}, a ${preprocessing.highpassHz}–${preprocessing.lowpassHz} Hz zero-phase biquad filter, and ${reference}. User-reviewed artifact exclusions removed ${artifacts.reduce((sum, item) => sum + item.end - item.start, 0).toFixed(1)} s before spectral estimation.

Power spectral density was estimated with Welch's method using 4.096 s Hann-windowed segments, 50% overlap, constant detrending within each segment, one-sided density scaling, and a 1–45 Hz fit range. Spectra were parameterized with a fixed aperiodic mode and Gaussian peak model. Reported outputs include aperiodic exponent and offset, full-model R² and RMSE, and the strongest 7–14 Hz alpha peak center frequency, power, and bandwidth. Conditions analyzed: ${conditionText}.

${validationMethodsSentence()} Results are descriptive research outputs and are not diagnostic, causal, or inferential claims.`;
}

export function buildHtmlReport({ recording, selected, conditions, artifacts, conditionResults, duration, preprocessing, quality = [] }) {
  const rows = conditions.filter(condition => conditionResults[condition.id]).map(condition => {
    const result = conditionResults[condition.id];
    return `<tr><td>${escapeHtml(condition.name)}</td><td>${result.exponent.toFixed(2)}</td><td>${result.offset.toFixed(2)}</td><td>${result.r2.toFixed(3)}</td><td>${result.error.toFixed(3)}</td><td>${result.alphaCF ? result.alphaCF.toFixed(1) : "—"}</td><td>${result.alphaPW ? result.alphaPW.toFixed(2) : "—"}</td><td>${escapeHtml(result.confidence?.label || "Review")}</td></tr>`;
  }).join("");
  const methodText = buildMethodsSummary({ recording, selected, conditions, artifacts, preprocessing, duration });
  const qualityRows = quality.map(channel => `<li><strong>${escapeHtml(channel.name)}</strong>: ${escapeHtml(channel.status)} · SD ${channel.standardDeviation.toFixed(1)} µV · p99 ${channel.p99Amplitude.toFixed(1)} µV</li>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Flux EEG report</title><style>body{font:14px system-ui;color:#172534;max-width:960px;margin:48px auto;padding:0 24px}h1{margin-bottom:4px}h2{margin-top:32px}p{color:#526777;line-height:1.6;white-space:pre-line}table{width:100%;border-collapse:collapse;margin:24px 0}th,td{text-align:left;padding:9px;border-bottom:1px solid #d8e0e6}small{color:#6f8290}.badge{display:inline-block;padding:5px 9px;border-radius:99px;background:#e5f6eb;color:#24663d;font-weight:700}li{margin:6px 0}</style></head><body><h1>Flux EEG analysis report</h1><p>${escapeHtml(recording.name)} · ${recording.rate} Hz · ${duration.toFixed(1)} seconds · channels ${selected.map(escapeHtml).join(", ")}</p><span class="badge">Reference validation passed · ${REFERENCE_VALIDATION.fixtures}/${REFERENCE_VALIDATION.fixtures} fixtures</span><table><thead><tr><th>Condition</th><th>Exponent</th><th>Offset</th><th>R²</th><th>RMSE</th><th>Alpha CF</th><th>Alpha PW</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table><h2>Channel quality</h2><ul>${qualityRows || "<li>No quality metrics recorded.</li>"}</ul><h2>Reproducible methods</h2><p>${escapeHtml(methodText)}</p><small>Generated by Flux EEG V0.4. Descriptive research output; not diagnosis or statistical inference.</small></body></html>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

export function buildResultsCsv(conditions, conditionResults) {
  const rows = [
    ["condition", "start_s", "end_s", "exponent", "offset", "r2", "rmse", "alpha_cf_hz", "alpha_pw", "alpha_bw_hz", "confidence"],
    ...conditions.filter(condition => conditionResults[condition.id]).map(condition => {
      const result = conditionResults[condition.id];
      return [condition.name, condition.start, condition.end, result.exponent, result.offset, result.r2, result.error, result.alphaCF, result.alphaPW, result.alphaBW, result.confidence?.label || "Review"];
    }),
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function buildPublicationFigure({ recording, selected, condition, result, dynamic = [], preprocessing }) {
  if (typeof document === "undefined") throw new Error("Figure export requires a browser.");
  if (!result) throw new Error("Analyze a selection before exporting a figure.");
  const canvas = document.createElement("canvas");
  canvas.width = 1800;
  canvas.height = 1100;
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#16283a";
  context.font = "700 46px system-ui";
  context.fillText("Flux EEG · Aperiodic spectral analysis", 90, 90);
  context.fillStyle = "#617485";
  context.font = "24px system-ui";
  context.fillText(`${recording.name} · ${selected.join(" + ")} · ${condition.name}`, 90, 132);
  const metrics = [
    ["Exponent", result.exponent.toFixed(2)], ["Offset", result.offset.toFixed(2)], ["Model R²", result.r2.toFixed(3)],
    ["Alpha CF", result.alphaCF ? `${result.alphaCF.toFixed(1)} Hz` : "—"], ["Alpha PW", result.alphaCF ? result.alphaPW.toFixed(2) : "—"], ["Alpha BW", result.alphaCF ? `${result.alphaBW.toFixed(1)} Hz` : "—"],
  ];
  metrics.forEach(([label, value], index) => {
    const x = 90 + (index % 3) * 270;
    const y = 205 + Math.floor(index / 3) * 105;
    context.fillStyle = "#728392";
    context.font = "20px system-ui";
    context.fillText(label, x, y);
    context.fillStyle = "#10263a";
    context.font = "700 36px system-ui";
    context.fillText(value, x, y + 43);
  });
  drawSpectrumFigure(context, result, { x: 90, y: 440, width: 1000, height: 510 });
  drawDynamicsFigure(context, dynamic, { x: 1160, y: 440, width: 550, height: 510 });
  context.fillStyle = "#617485";
  context.font = "18px system-ui";
  context.fillText(`Pipeline: detrend ${preprocessing.detrend ? "on" : "off"} · notch ${preprocessing.notchHz || "off"} Hz · ${preprocessing.highpassHz}–${preprocessing.lowpassHz} Hz · ${preprocessing.reference}`, 90, 1025);
  context.fillText(`Validated against SciPy ${REFERENCE_VALIDATION.scipy} + specparam ${REFERENCE_VALIDATION.specparam} · descriptive research output`, 90, 1060);
  return canvas.toDataURL("image/png");
}

function drawSpectrumFigure(context, result, box) {
  const points = result.freq.map((frequency, index) => ({ frequency, power: result.psd[index], fit: result.aperiodicFit[index] })).filter(point => point.frequency >= 1 && point.frequency <= 45);
  const logs = points.map(point => Math.log10(Math.max(point.power, 1e-12)));
  const minimum = Math.min(...logs);
  const maximum = Math.max(...logs);
  const x = frequency => box.x + Math.log10(frequency) / Math.log10(45) * box.width;
  const y = power => box.y + (maximum - Math.log10(Math.max(power, 1e-12))) / Math.max(0.01, maximum - minimum) * box.height;
  context.strokeStyle = "#d7e0e7";
  context.lineWidth = 2;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.strokeStyle = "#1e9ac6";
  context.lineWidth = 4;
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(x(point.frequency), y(point.power)) : context.moveTo(x(point.frequency), y(point.power)));
  context.stroke();
  context.strokeStyle = "#79a922";
  context.lineWidth = 4;
  context.beginPath();
  points.forEach((point, index) => index ? context.lineTo(x(point.frequency), y(point.fit)) : context.moveTo(x(point.frequency), y(point.fit)));
  context.stroke();
  if (result.alphaCF) {
    context.strokeStyle = "#7656b0";
    context.setLineDash([10, 8]);
    context.beginPath(); context.moveTo(x(result.alphaCF), box.y); context.lineTo(x(result.alphaCF), box.y + box.height); context.stroke();
    context.setLineDash([]);
  }
  context.fillStyle = "#263b4d";
  context.font = "700 24px system-ui";
  context.fillText("Power spectral density", box.x, box.y - 24);
}

function drawDynamicsFigure(context, dynamic, box) {
  context.strokeStyle = "#d7e0e7";
  context.lineWidth = 2;
  context.strokeRect(box.x, box.y, box.width, box.height);
  context.fillStyle = "#263b4d";
  context.font = "700 24px system-ui";
  context.fillText("Exponent through time", box.x, box.y - 24);
  const reliable = dynamic.filter(point => (point.r2 ?? 1) >= 0.9);
  if (!reliable.length) {
    context.fillStyle = "#728392";
    context.font = "21px system-ui";
    context.fillText("No reliable moving windows", box.x + 38, box.y + box.height / 2);
    return;
  }
  const minimum = Math.min(...reliable.map(point => point.v));
  const maximum = Math.max(...reliable.map(point => point.v));
  const maxTime = Math.max(...reliable.map(point => point.t));
  const x = time => box.x + time / Math.max(1, maxTime) * box.width;
  const y = value => box.y + (maximum - value) / Math.max(0.1, maximum - minimum) * box.height;
  context.strokeStyle = "#79a922";
  context.lineWidth = 4;
  context.beginPath();
  reliable.forEach((point, index) => index ? context.lineTo(x(point.t), y(point.v)) : context.moveTo(x(point.t), y(point.v)));
  context.stroke();
}
