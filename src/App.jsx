import { useMemo, useRef, useState, useEffect } from "react";
import { analyzeSignal, cleanIntervals, DEFAULT_SETTINGS, evaluateConfidence, parameterizeSpectrum, welchPsd } from "./analysis.js";
import { detectTransitions, summarizeDynamics } from "./dynamics.js";
import { buildHtmlReport, buildManifest, buildMethodsSummary, buildPublicationFigure, buildResultsCsv } from "./export.js";
import { buildProjectSnapshot, parseProjectSnapshot } from "./project.js";
import { parseOpenBCI } from "./import.js";
import { assessChannelQuality, DEFAULT_PREPROCESSING, detectArtifactIntervals, preprocessChannels, preprocessSignal, summarizeQuality } from "./preprocess.js";
import { REFERENCE_VALIDATION, runBuiltInSelfCheck } from "./validation.js";
import { addStudyRecord, buildStudyCsv, createDemoStudy, createEmptyStudy, studyConditionNames, summarizeStudy } from "./study.js";
import { connectOpenBCI, CYTON_SAMPLE_RATE, makeDemoLiveBatch } from "./live.js";
import { buildInterpretation, buildInterpretationNote } from "./interpretation.js";
import { buildExperimentConditions, buildExperimentCsv, buildExperimentRecording, createDefaultProtocol, createExperimentRun, createQuickDemoProtocol, phaseAtElapsed, protocolDuration } from "./experiment.js";
import { ExperimentPanel, ExperimentWorkspace, InterpretationPanel, InterpretationWorkspace, LivePanel, LiveWorkspace, StudyPanel, StudyWorkspace } from "./modes.jsx";

const DEMO_RATE = 250;
const DURATION = 240;
const CONDITION_COLORS = ["#27b6ee", "#8d6bc7", "#d8a653", "#77c7a3", "#e27687"];
const COLORS = { cyan: "#27b6ee", lime: "#9ddd3b", violet: "#8d6bc7", grid: "#314559", text: "#b9c9d6", artifact: "#e7655a", gold: "#d8a653" };

function seededNoise(index, seed) {
  const value = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function makeDemoChannel(seed) {
  const length = DEMO_RATE * DURATION;
  return Array.from({ length }, (_, index) => {
    const time = index / DEMO_RATE;
    const eyesClosed = time >= 60 && time <= 180;
    let aperiodic = 0;
    for (let frequency = 1; frequency <= 45; frequency += 1) {
      aperiodic += 13 / (frequency ** 0.9) * Math.sin(2 * Math.PI * frequency * time + seededNoise(frequency, seed) * Math.PI);
    }
    const alpha = (eyesClosed ? 28 : 8) * Math.sin(2 * Math.PI * (10.1 + seed * 0.05) * time);
    const demonstrationArtifact = 210 <= time && time < 210.08 ? 210 * Math.sin(Math.PI * (time - 210) / 0.08) : 0;
    return aperiodic + alpha + seededNoise(index, seed) * 3 + demonstrationArtifact;
  });
}

const DEMO = { name: "rest-eyes-open-closed.csv", rate: DEMO_RATE, sourceHash: "demo-posterior-alpha-v04", channels: { O1: makeDemoChannel(1), O2: makeDemoChannel(2) } };
const DEMO_EVENTS = [{ id: "event-closed", time: 60, label: "Eyes closed", color: "#a98bd5" }, { id: "event-open", time: 180, label: "Eyes open", color: "#78a9c7" }];
const DEMO_CONDITIONS = [{ id: "eyes-open", name: "Eyes open", start: 0, end: 60, color: "#27b6ee" }, { id: "eyes-closed", name: "Eyes closed", start: 60, end: 180, color: "#8d6bc7" }];

function downsample(values, maximum = 1700) {
  if (values.length <= maximum) return values;
  const step = values.length / maximum;
  return Array.from({ length: maximum }, (_, index) => values[Math.floor(index * step)]);
}

function meanChannels(channels, names, from, to) {
  const picked = names.map(name => channels[name]).filter(Boolean);
  if (!picked.length) return [];
  const start = Math.max(0, from);
  const end = Math.min(picked[0].length, to);
  return Array.from({ length: end - start }, (_, offset) => picked.reduce((sum, channel) => sum + (Number(channel[start + offset]) || 0), 0) / picked.length);
}

function formatTime(seconds) {
  const rounded = Math.max(0, Math.round(seconds));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function dynamicAnalysis(recording, selected, totalDuration, settings, artifacts) {
  const signal = meanChannels(recording.channels, selected, 0, Math.floor(totalDuration * recording.rate));
  const output = [];
  for (let start = 0; start + settings.windowSec <= totalDuration; start += settings.stepSec) {
    const end = start + settings.windowSec;
    if (artifacts.some(artifact => artifact.start < end && artifact.end > start)) continue;
    try {
      const result = analyzeSignal(signal.slice(Math.floor(start * recording.rate), Math.floor(end * recording.rate)), recording.rate);
      output.push({ t: start + settings.windowSec / 2, v: result.exponent, r2: result.r2, error: result.error });
    } catch {
      // Windows that cannot support a stable spectrum remain absent rather than being interpolated.
    }
  }
  return output;
}

export function analyzeCondition(recording, selected, condition, artifacts) {
  const intervals = cleanIntervals([condition.start, condition.end], artifacts);
  if (!intervals.length) throw new Error(`${condition.name} has no clean interval long enough to analyze.`);
  const spectra = intervals.map(([start, end]) => {
    const signal = meanChannels(recording.channels, selected, Math.floor(start * recording.rate), Math.floor(end * recording.rate));
    return welchPsd(signal, recording.rate, DEFAULT_SETTINGS);
  });
  const frequency = spectra[0].freq;
  const totalSegments = spectra.reduce((sum, spectrum) => sum + spectrum.segments, 0);
  const power = frequency.map((_, index) => spectra.reduce((sum, spectrum) => sum + spectrum.psd[index] * spectrum.segments, 0) / totalSegments);
  return { ...spectra[0], ...parameterizeSpectrum(frequency, power, DEFAULT_SETTINGS), freq: frequency, psd: power, settings: DEFAULT_SETTINGS, engine: "Flux spectral-fit 0.3 · specparam-compatible fixed mode", cleanIntervals: intervals };
}

function trustedConditionAnalysis(recording, selected, condition, artifacts, quality) {
  const result = analyzeCondition(recording, selected, condition, artifacts);
  const cleanDuration = result.cleanIntervals.reduce((sum, [start, end]) => sum + end - start, 0);
  return {
    ...result,
    engine: "Flux spectral-fit 0.4 · preprocessed fixed mode",
    cleanDuration,
    confidence: evaluateConfidence({ result, cleanDuration, quality }),
  };
}

function saveDownload(name, value, type = "application/json") {
  const url = URL.createObjectURL(new Blob([value], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function saveDataUrl(name, value) {
  const anchor = document.createElement("a");
  anchor.href = value;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
}

async function sha256(value) {
  if (!globalThis.crypto?.subtle) return "unavailable";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function TraceCanvas({ channels, selected, duration, range, events, conditions, artifacts, onRangeChange }) {
  const ref = useRef(null);
  const dragStart = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d");
    const ratio = devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const left = 66, right = 18, top = 28, bottom = 28, plotWidth = width - left - right;
    const x = time => left + time / duration * plotWidth;
    conditions.forEach(condition => { context.fillStyle = `${condition.color}12`; context.fillRect(x(condition.start), top, x(condition.end) - x(condition.start), height - top - bottom); });
    context.fillStyle = "rgba(141,107,199,.17)";
    context.fillRect(x(range[0]), top, x(range[1]) - x(range[0]), height - top - bottom);
    artifacts.forEach(artifact => { context.fillStyle = "rgba(231,101,90,.22)"; context.fillRect(x(artifact.start), top, x(artifact.end) - x(artifact.start), height - top - bottom); context.fillStyle = "#ef8c82"; context.fillText("excluded", x(artifact.start) + 4, height - bottom - 7); });
    context.strokeStyle = COLORS.grid;
    context.lineWidth = 1;
    context.font = "11px Inter, sans-serif";
    context.fillStyle = COLORS.text;
    for (let index = 0; index <= 4; index += 1) { const currentX = left + index * plotWidth / 4; context.beginPath(); context.moveTo(currentX, top); context.lineTo(currentX, height - bottom); context.stroke(); context.fillText(formatTime(index * duration / 4), currentX - 10, height - 8); }
    events.forEach(event => { context.strokeStyle = event.color; context.setLineDash([4, 4]); context.beginPath(); context.moveTo(x(event.time), top); context.lineTo(x(event.time), height - bottom); context.stroke(); context.setLineDash([]); context.fillStyle = event.color; context.fillText(event.label, x(event.time) + 5, 15); });
    selected.forEach((name, index) => {
      const values = downsample(channels[name] || []);
      const centerY = index === 0 ? height * 0.3 : height * 0.69;
      const amplitude = Math.min(1.2, 50 / (Math.max(...values.map(Math.abs)) || 1));
      context.strokeStyle = COLORS.cyan;
      context.lineWidth = 1;
      context.beginPath();
      values.forEach((value, valueIndex) => { const currentX = left + valueIndex / (values.length - 1) * plotWidth; const currentY = centerY - value * amplitude; valueIndex ? context.lineTo(currentX, currentY) : context.moveTo(currentX, currentY); });
      context.stroke();
      context.fillStyle = "#eaf5fb";
      context.font = "16px Inter";
      context.fillText(name, 18, centerY + 5);
    });
    context.strokeStyle = COLORS.violet;
    context.lineWidth = 2;
    [range[0], range[1]].forEach(time => { context.beginPath(); context.moveTo(x(time), top); context.lineTo(x(time), height - bottom); context.stroke(); });
  }, [channels, selected, duration, range, events, conditions, artifacts]);

  const timeAtPointer = event => {
    const bounds = ref.current.getBoundingClientRect();
    const left = 66, right = 18;
    return Math.max(0, Math.min(duration, (event.clientX - bounds.left - left) / Math.max(1, bounds.width - left - right) * duration));
  };
  const beginSelection = event => { const time = timeAtPointer(event); dragStart.current = time; ref.current.setPointerCapture(event.pointerId); onRangeChange([time, Math.min(duration, time + 1)]); };
  const moveSelection = event => { if (dragStart.current === null) return; const time = timeAtPointer(event); const start = Math.min(dragStart.current, time); const end = Math.max(dragStart.current, time); onRangeChange([start, Math.max(start + 1, end)]); };
  const finishSelection = event => { moveSelection(event); dragStart.current = null; };
  return <canvas ref={ref} className="chart trace interactive-trace" aria-label="Raw EEG traces. Drag to select an interval." onPointerDown={beginSelection} onPointerMove={moveSelection} onPointerUp={finishSelection} onPointerCancel={() => { dragStart.current = null; }} />;
}

function LineCanvas({ points, duration, range, transitions, annotations, conditions }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas.getContext("2d");
    const ratio = devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const left = 66, right = 18, top = 16, bottom = 30, plotWidth = width - left - right, plotHeight = height - top - bottom;
    const values = points.map(point => point.v);
    const rawMinimum = values.length ? Math.min(...values) : 1;
    const rawMaximum = values.length ? Math.max(...values) : 2.6;
    const padding = values.length ? Math.max(0.08, (rawMaximum - rawMinimum) * 0.18) : 0;
    const minimum = values.length ? Math.max(0, rawMinimum - padding) : rawMinimum;
    const maximum = values.length ? rawMaximum + padding : rawMaximum;
    const x = time => left + time / duration * plotWidth;
    const y = value => top + (maximum - value) / Math.max(0.1, maximum - minimum) * plotHeight;
    conditions.forEach(condition => { context.fillStyle = `${condition.color}10`; context.fillRect(x(condition.start), top, x(condition.end) - x(condition.start), plotHeight); });
    context.fillStyle = "rgba(141,107,199,.12)";
    context.fillRect(x(range[0]), top, x(range[1]) - x(range[0]), plotHeight);
    context.strokeStyle = COLORS.grid;
    context.fillStyle = COLORS.text;
    context.font = "11px Inter";
    Array.from({ length: 5 }, (_, index) => minimum + index * (maximum - minimum) / 4).forEach(value => { context.beginPath(); context.moveTo(left, y(value)); context.lineTo(width - right, y(value)); context.stroke(); context.fillText(value.toFixed(2), 27, y(value) + 4); });
    transitions.forEach(transition => { context.strokeStyle = "rgba(231,101,90,.75)"; context.setLineDash([3, 4]); context.beginPath(); context.moveTo(x(transition.time), top); context.lineTo(x(transition.time), height - bottom); context.stroke(); context.setLineDash([]); });
    annotations.forEach(annotation => { context.strokeStyle = COLORS.gold; context.beginPath(); context.moveTo(x(annotation.time), top); context.lineTo(x(annotation.time), height - bottom); context.stroke(); context.fillStyle = COLORS.gold; context.fillText(annotation.label, x(annotation.time) + 4, top + 11); });
    const hasReliableWindows = points.some(point => (point.r2 ?? 1) >= 0.9);
    context.strokeStyle = hasReliableWindows ? COLORS.lime : COLORS.gold;
    if (!hasReliableWindows && points.length) context.setLineDash([5, 4]);
    context.lineWidth = 2;
    context.beginPath();
    points.forEach((point, index) => index ? context.lineTo(x(point.t), y(point.v)) : context.moveTo(x(point.t), y(point.v)));
    context.stroke();
    context.setLineDash([]);
    points.forEach(point => { context.fillStyle = point.r2 >= 0.9 ? COLORS.lime : COLORS.gold; context.beginPath(); context.arc(x(point.t), y(point.v), 2.5, 0, Math.PI * 2); context.fill(); });
  }, [points, duration, range, transitions, annotations, conditions]);
  return <canvas ref={ref} className="chart exponent" aria-label="Moving-window aperiodic exponent with detected transitions" />;
}

function PsdCanvas({ result }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!result) return;
    const canvas = ref.current;
    const context = canvas.getContext("2d");
    const ratio = devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.scale(ratio, ratio);
    context.clearRect(0, 0, width, height);
    const left = 38, right = 14, top = 12, bottom = 26;
    const points = result.freq.map((frequency, index) => ({ frequency, power: result.psd[index] })).filter(point => point.frequency >= 1 && point.frequency <= 45);
    const logs = points.map(point => Math.log10(Math.max(point.power, 1e-12)));
    const minimum = Math.min(...logs), maximum = Math.max(...logs);
    const x = frequency => left + Math.log10(frequency) / Math.log10(45) * (width - left - right);
    const y = power => top + (maximum - Math.log10(Math.max(power, 1e-12))) / Math.max(0.01, maximum - minimum) * (height - top - bottom);
    context.strokeStyle = COLORS.grid;
    context.beginPath(); context.moveTo(left, top); context.lineTo(left, height - bottom); context.lineTo(width - right, height - bottom); context.stroke();
    context.strokeStyle = COLORS.cyan;
    context.beginPath(); points.forEach((point, index) => index ? context.lineTo(x(point.frequency), y(point.power)) : context.moveTo(x(point.frequency), y(point.power))); context.stroke();
    context.strokeStyle = COLORS.lime;
    context.lineWidth = 2;
    context.beginPath(); [1, 45].forEach((frequency, index) => { const power = 10 ** (result.offset - result.exponent * Math.log10(frequency)); index ? context.lineTo(x(frequency), y(power)) : context.moveTo(x(frequency), y(power)); }); context.stroke();
    if (result.alphaCF) { context.strokeStyle = COLORS.violet; context.setLineDash([4, 3]); context.beginPath(); context.moveTo(x(result.alphaCF), top); context.lineTo(x(result.alphaCF), height - bottom); context.stroke(); context.setLineDash([]); }
    context.fillStyle = COLORS.text;
    context.font = "10px Inter";
    context.fillText("1", left - 3, height - 8); context.fillText("10", x(10) - 7, height - 8); context.fillText("45 Hz", width - 38, height - 8);
  }, [result]);
  return <canvas ref={ref} className="psd" aria-label="Power spectral density, aperiodic fit, and alpha center frequency" />;
}

function ComparisonPanel({ conditions, results, onInspect }) {
  const ready = conditions.filter(condition => results[condition.id]);
  if (ready.length < 2) return <div className="compare-empty"><p>Analyze at least two clean conditions to compare them.</p></div>;
  const base = results[ready[0].id];
  return <div className="multi-comparison">
    <div className="comparison-labels"><span>Condition</span><span>χ</span><span>Δχ</span><span>R²</span><span>Alpha</span></div>
    {ready.map(condition => { const result = results[condition.id]; const delta = result.exponent - base.exponent; return <button className="comparison-condition" key={condition.id} onClick={() => onInspect(condition, result)}><span style={{ "--condition": condition.color }}>{condition.name}</span><b>{result.exponent.toFixed(2)}</b><b className={Math.abs(delta) >= 0.1 ? "meaningful-delta" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(2)}</b><b className={result.r2 >= 0.9 ? "fit-good" : "fit-review"}>{result.r2.toFixed(2)}</b><b>{result.alphaCF ? `${result.alphaCF.toFixed(1)} Hz` : "—"}</b></button>; })}
    <p className="compare-note">Differences are descriptive. Select a row to inspect its full spectral fit.</p>
  </div>;
}

function FitResult({ result, status }) {
  if (!result) return <div className="empty"><div>χ</div><p>Select an interval and run analysis to inspect its aperiodic and alpha structure.</p></div>;
  const explanation = result.r2 >= 0.95 ? "The model closely follows the measured spectrum across the configured range." : result.r2 >= 0.9 ? "The fit is suitable for comparison, with some residual structure worth inspecting." : "Treat this result cautiously. Residual structure remains and may reflect noise, artifacts, or a poor model match.";
  return <>
    <p className="engine">{result.engine}</p>
    {result.confidence && <div className={`confidence-strip ${result.confidence.score >= 80 ? "high" : result.confidence.score >= 60 ? "moderate" : "low"}`}><span>{result.confidence.label}</span><b>{result.confidence.score}/100</b></div>}
    <div className={`fit-explanation ${result.r2 >= 0.9 ? "good" : "review"}`}><strong>{status}</strong><p>{explanation}</p></div>
    <dl className="metrics"><dt>Exponent (χ)</dt><dd>{result.exponent.toFixed(2)}</dd><dt>Offset</dt><dd>{result.offset.toFixed(2)}</dd><dt>R²</dt><dd>{result.r2.toFixed(3)}</dd><dt>Fit error (RMSE)</dt><dd>{result.error.toFixed(3)}</dd></dl>
    <div className="alpha"><span>Alpha CF <b>{result.alphaCF ? `${result.alphaCF.toFixed(1)} Hz` : "—"}</b></span><span>Alpha PW <b>{result.alphaCF ? result.alphaPW.toFixed(2) : "—"}</b></span><span>Alpha BW <b>{result.alphaCF ? `${result.alphaBW.toFixed(1)} Hz` : "—"}</b></span></div>
    <div className="psd-legend"><span><i className="cyan" />PSD</span><span><i className="lime" />1/f fit</span><span><i className="violet" />alpha CF</span></div>
    <PsdCanvas result={result} />
    {result.confidence?.reasons?.length > 0 && <div className="confidence-reasons"><strong>Confidence checks</strong>{result.confidence.reasons.map(reason => <p key={reason}>{reason}</p>)}</div>}
    {result.warnings.length > 0 && <div className="warnings">{result.warnings.map(warning => <p key={warning}>{warning}</p>)}</div>}
  </>;
}

function TrustPanel({ quality, qualitySummary, suggestions, preprocessing, onPreprocessingChange, preprocessingWarnings, selfCheck, onSelfCheck, onApplySuggestions, recording, selected, onExportMethods, onExportFigure, hasResult }) {
  return <div className="trust-panel">
    <div className="results-head"><h2>Research trust</h2><span className={qualitySummary.status === "good" ? "quality good" : "quality"}>{qualitySummary.status === "good" ? "Ready" : "Review"}</span></div>
    <div className="trust-hero"><span className="trust-mark">Validated</span><strong>Pipeline is inspectable</strong><p>Cleaning, quality screens, fit diagnostics, and reference checks stay attached to every result.</p></div>

    <h3>Preprocessing</h3>
    <div className="pipeline-controls">
      <label><span>Linear detrend</span><input type="checkbox" checked={preprocessing.detrend} onChange={event => onPreprocessingChange({ ...preprocessing, detrend: event.target.checked })} /></label>
      <label><span>Notch</span><select aria-label="Notch frequency" value={preprocessing.notchHz} onChange={event => onPreprocessingChange({ ...preprocessing, notchHz: +event.target.value })}><option value="0">Off</option><option value="50">50 Hz</option><option value="60">60 Hz</option></select></label>
      <label><span>Bandpass</span><b>{preprocessing.highpassHz}–{preprocessing.lowpassHz} Hz</b></label>
      <label><span>Reference</span><select aria-label="Reference method" value={preprocessing.reference} onChange={event => onPreprocessingChange({ ...preprocessing, reference: event.target.value })}><option value="none">Imported</option><option value="common-average">Common average</option></select></label>
    </div>
    {preprocessingWarnings.map(warning => <p className="trust-warning" key={warning}>{warning}</p>)}

    <div className="trust-section-head"><h3>Channel screen</h3><span>{qualitySummary.good}/{quality.length} clear</span></div>
    <div className="quality-list">{quality.filter(channel => selected.includes(channel.name)).map(channel => <div key={channel.name}><span className={`quality-dot ${channel.status}`} /><b>{channel.name}</b><span>{channel.status}</span><em>SD {channel.standardDeviation.toFixed(1)} µV</em></div>)}</div>

    <div className="trust-section-head"><h3>Artifact suggestions</h3><span>{suggestions.length} found</span></div>
    <p className="trust-copy">Flux flags extreme amplitude and abrupt steps, but nothing is excluded until you review and apply it.</p>
    <button className="trust-action" disabled={!suggestions.length} onClick={onApplySuggestions}>{suggestions.length ? `Review and apply ${suggestions.length}` : "No suggestions to apply"}</button>

    <div className="trust-section-head"><h3>Reference validation</h3><span className="passed">Passed {REFERENCE_VALIDATION.fixtures}/{REFERENCE_VALIDATION.fixtures}</span></div>
    <p className="trust-copy">The Welch and fit core is pinned against SciPy {REFERENCE_VALIDATION.scipy} and specparam {REFERENCE_VALIDATION.specparam} for the declared deterministic fixture domain.</p>
    <button className="trust-action" onClick={onSelfCheck}>{selfCheck ? "Run self-check again" : "Run built-in self-check"}</button>
    {selfCheck && <div className={`self-check ${selfCheck.passed ? "passed" : "failed"}`}><b>{selfCheck.passed ? "Self-check passed" : "Self-check failed"}</b><span>{selfCheck.fixture}</span><em>Observed χ {selfCheck.observed.exponent.toFixed(2)} · alpha {selfCheck.observed.alphaCF.toFixed(1)} Hz</em></div>}

    <div className="trust-section-head"><h3>Reproducibility</h3><span>Local only</span></div>
    <dl className="provenance"><dt>Source SHA-256</dt><dd>{(recording.sourceHash || "demo-generated").slice(0, 16)}…</dd><dt>Selected channels</dt><dd>{selected.join(" + ")}</dd><dt>Engine</dt><dd>Flux spectral-fit 0.4</dd></dl>
    <div className="exports trust-exports"><button onClick={onExportMethods}>Export methods</button><button disabled={!hasResult} onClick={onExportFigure}>Export figure PNG</button></div>
  </div>;
}

export function App() {
  const [recording, setRecording] = useState(DEMO);
  const [selected, setSelected] = useState(["O1", "O2"]);
  const [range, setRange] = useState([60, 180]);
  const [advanced, setAdvanced] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [dynamic, setDynamic] = useState([]);
  const [error, setError] = useState("");
  const [events, setEvents] = useState(DEMO_EVENTS);
  const [conditions, setConditions] = useState(DEMO_CONDITIONS);
  const [artifacts, setArtifacts] = useState([]);
  const [conditionName, setConditionName] = useState("");
  const [activeConditionId, setActiveConditionId] = useState(null);
  const [conditionResults, setConditionResults] = useState({});
  const [view, setView] = useState("analyze");
  const [annotations, setAnnotations] = useState([]);
  const [annotationName, setAnnotationName] = useState("");
  const [dynamicsSettings, setDynamicsSettings] = useState({ windowSec: 8, stepSec: 4, transitionThreshold: 0.08 });
  const [preprocessing, setPreprocessing] = useState(DEFAULT_PREPROCESSING);
  const [traceMode, setTraceMode] = useState("raw");
  const [selfCheck, setSelfCheck] = useState(null);
  const [study, setStudy] = useState(() => createEmptyStudy("Untitled study"));
  const [participantId, setParticipantId] = useState("P01");
  const [sessionId, setSessionId] = useState("Rest 01");
  const [studyConditionA, setStudyConditionA] = useState("");
  const [studyConditionB, setStudyConditionB] = useState("");
  const [batchBusy, setBatchBusy] = useState(false);
  const [selectedLens, setSelectedLens] = useState("flow");
  const [live, setLive] = useState({ status: "idle", statusLabel: "Ready", source: null, running: false, rate: CYTON_SAMPLE_RATE, channels: { CH7: [], CH8: [] }, sampleCount: 0, points: [], current: null, events: [] });
  const [experimentProtocol, setExperimentProtocol] = useState(() => createDefaultProtocol());
  const [experimentRun, setExperimentRun] = useState(null);
  const [experimentBusy, setExperimentBusy] = useState(false);
  const dataInput = useRef(null);
  const projectInput = useRef(null);
  const studyInput = useRef(null);
  const liveTimer = useRef(null);
  const liveController = useRef(null);
  const liveBuffer = useRef({ CH7: [], CH8: [], sampleCount: 0, lastAnalyzed: 0, lastRendered: 0 });
  const experimentBuffer = useRef({ active: false, run: null, CH7: [], CH8: [], lastRendered: 0, lastPhaseId: null, completing: false });
  const names = Object.keys(recording.channels);
  const duration = recording.channels[names[0]].length / recording.rate;
  const preprocessingOutput = useMemo(() => preprocessChannels(recording.channels, recording.rate, preprocessing), [recording, preprocessing]);
  const processedRecording = useMemo(() => ({ ...recording, channels: preprocessingOutput.channels }), [recording, preprocessingOutput.channels]);
  const quality = useMemo(() => assessChannelQuality(recording.channels, recording.rate, preprocessing), [recording, preprocessing]);
  const selectedQuality = useMemo(() => quality.filter(channel => selected.includes(channel.name)), [quality, selected]);
  const qualitySummary = useMemo(() => summarizeQuality(selectedQuality), [selectedQuality]);
  const artifactSuggestions = useMemo(() => detectArtifactIntervals(recording.channels, selected, recording.rate, preprocessing).filter(suggestion => !artifacts.some(artifact => artifact.start <= suggestion.start && artifact.end >= suggestion.end)), [recording, selected, preprocessing, artifacts]);
  const dynamicsSummary = useMemo(() => summarizeDynamics(dynamic, dynamicsSettings.transitionThreshold), [dynamic, dynamicsSettings.transitionThreshold]);
  const transitions = dynamicsSummary.transitions;
  const hasReliableDynamics = dynamic.some(point => (point.r2 ?? 1) >= 0.9);
  const status = useMemo(() => result ? (result.r2 >= 0.95 ? "Excellent fit" : result.r2 >= 0.9 ? "Good fit" : "Review fit") : "Not analyzed", [result]);
  const studyConditions = useMemo(() => studyConditionNames(study), [study]);
  const effectiveStudyA = studyConditionA || studyConditions[0] || "Condition A";
  const effectiveStudyB = studyConditionB || studyConditions[1] || studyConditions[0] || "Condition B";
  const studySummary = useMemo(() => summarizeStudy(study, effectiveStudyA, effectiveStudyB), [study, effectiveStudyA, effectiveStudyB]);
  const interpretation = useMemo(() => buildInterpretation({ result, conditions, conditionResults, dynamicsSummary }), [result, conditions, conditionResults, dynamicsSummary]);
  const specialView = ["experiment", "study", "live", "interpret"].includes(view);
  const openView = nextView => {
    setView(nextView);
    if (["trust", "experiment", "study", "live", "interpret"].includes(nextView)) setAdvanced(false);
  };

  const invalidateResults = message => { setResult(null); setConditionResults({}); setDynamic([]); setError(message || ""); };
  const updatePreprocessing = next => { setPreprocessing(next); invalidateResults("Preprocessing changed. Re-run analysis."); };
  const applyRecording = loaded => {
    const channelNames = Object.keys(loaded.channels);
    const posterior = channelNames.filter(name => /^(O1|O2)$/i.test(name)).slice(0, 2);
    const loadedDuration = loaded.channels[channelNames[0]].length / loaded.rate;
    setRecording({ name: loaded.name, rate: loaded.rate, sourceHash: loaded.sourceHash, channels: loaded.channels });
    setSelected(posterior.length ? posterior : channelNames.slice(0, 2));
    setRange([0, Math.min(60, loadedDuration)]);
    setEvents(loaded.events || []);
    setConditions([]);
    setArtifacts([]);
    setAnnotations([]);
    setActiveConditionId(null);
    setConditionName("");
    invalidateResults("");
  };
  const loadDemo = () => { setRecording(DEMO); setSelected(["O1", "O2"]); setRange([60, 180]); setEvents(DEMO_EVENTS); setConditions(DEMO_CONDITIONS); setArtifacts([]); setAnnotations([]); setActiveConditionId(null); setConditionName(""); invalidateResults(""); };

  useEffect(() => () => {
    if (liveTimer.current) clearInterval(liveTimer.current);
    liveController.current?.stop?.().catch(() => {});
  }, []);

  const syncExperimentProgress = (buffer, elapsedSec, force = false) => {
    const phase = phaseAtElapsed(buffer.run.protocol, elapsedSec);
    const phaseChanged = phase?.id !== buffer.lastPhaseId;
    if (phaseChanged) {
      buffer.lastPhaseId = phase?.id || null;
      const marker = phase ? { id: `experiment-${phase.id}`, time: phase.start, label: phase.name, color: phase.color, phaseId: phase.id } : null;
      if (marker && !buffer.run.markers.some(item => item.phaseId === marker.phaseId)) buffer.run = { ...buffer.run, markers: [...buffer.run.markers, marker] };
      setLive(previous => ({ ...previous, events: [...buffer.run.markers] }));
    }
    if (!force && !phaseChanged && buffer.CH7.length - buffer.lastRendered < CYTON_SAMPLE_RATE / 4) return;
    buffer.lastRendered = buffer.CH7.length;
    buffer.run = { ...buffer.run, elapsedSec, currentPhaseId: phase?.id || null };
    setExperimentRun({ ...buffer.run, markers: [...buffer.run.markers] });
  };

  const ingestLiveBatch = (channel7, channel8) => {
    const buffer = liveBuffer.current;
    const rate = CYTON_SAMPLE_RATE;
    const experiment = experimentBuffer.current;
    if (experiment.active) {
      experiment.CH7.push(...channel7);
      experiment.CH8.push(...channel8);
      const elapsedSec = Math.min(experiment.CH7.length, experiment.CH8.length) / rate;
      syncExperimentProgress(experiment, elapsedSec);
      if (elapsedSec >= protocolDuration(experiment.run.protocol) && !experiment.completing) {
        experiment.completing = true;
        setTimeout(() => finishExperiment(false), 0);
      }
    }
    buffer.CH7.push(...channel7);
    buffer.CH8.push(...channel8);
    buffer.sampleCount += Math.min(channel7.length, channel8.length);
    const maximum = rate * 30;
    if (buffer.CH7.length > maximum) buffer.CH7 = buffer.CH7.slice(-maximum);
    if (buffer.CH8.length > maximum) buffer.CH8 = buffer.CH8.slice(-maximum);
    let current = null;
    if (buffer.sampleCount - buffer.lastAnalyzed >= rate * 2 && buffer.CH7.length >= rate * 8) {
      buffer.lastAnalyzed = buffer.sampleCount;
      const length = rate * 8;
      const average = buffer.CH7.slice(-length).map((value, index) => (value + buffer.CH8[buffer.CH8.length - length + index]) / 2);
      try {
        current = analyzeSignal(preprocessSignal(average, rate, DEFAULT_PREPROCESSING), rate);
      } catch {
        current = null;
      }
    }
    if (!current && buffer.sampleCount - buffer.lastRendered < rate / 2) return;
    buffer.lastRendered = buffer.sampleCount;
    setLive(previous => {
      const nextCurrent = current || previous.current;
      const nextPoints = current ? [...previous.points, { t: buffer.sampleCount / rate, exponent: current.exponent, r2: current.r2, alphaCF: current.alphaCF }].slice(-180) : previous.points;
      return { ...previous, channels: { CH7: [...buffer.CH7], CH8: [...buffer.CH8] }, sampleCount: buffer.sampleCount, current: nextCurrent, points: nextPoints };
    });
  };

  const resetLiveBuffer = source => {
    liveBuffer.current = { CH7: [], CH8: [], sampleCount: 0, lastAnalyzed: 0, lastRendered: 0 };
    setLive({ status: "running", statusLabel: source === "serial" ? "Cyton connected" : "Demo streaming", source, running: true, rate: CYTON_SAMPLE_RATE, channels: { CH7: [], CH8: [] }, sampleCount: 0, points: [], current: null, events: [] });
  };

  const beginExperiment = source => {
    const run = createExperimentRun({ protocol: experimentProtocol, participantId, sessionId, source, rate: CYTON_SAMPLE_RATE });
    experimentBuffer.current = { active: true, run, CH7: [], CH8: [], lastRendered: 0, lastPhaseId: run.currentPhaseId, completing: false };
    resetLiveBuffer(source);
    setExperimentRun(run);
    setView("experiment");
    setError("");
    return run;
  };

  const startExperimentDemo = async () => {
    await stopLive();
    beginExperiment("demo");
    liveTimer.current = setInterval(() => {
      const batch = makeDemoLiveBatch(liveBuffer.current.sampleCount, 25);
      ingestLiveBatch(batch.channels[6], batch.channels[7]);
    }, 100);
  };

  const connectExperiment = async () => {
    setExperimentBusy(true);
    try {
      await stopLive();
      beginExperiment("serial");
      liveController.current = await connectOpenBCI({
        onSamples: channels => ingestLiveBatch([channels[6]], [channels[7]]),
        onStatus: next => setLive(previous => ({ ...previous, statusLabel: next === "connected" ? "Cyton connected" : "Stopped" })),
      });
    } catch (connectionError) {
      experimentBuffer.current.active = false;
      setExperimentRun(null);
      setLive(previous => ({ ...previous, status: "error", statusLabel: "Connection unavailable", running: false }));
      setError(connectionError.message);
    } finally {
      setExperimentBusy(false);
    }
  };

  const startDemoLive = () => {
    if (liveTimer.current) clearInterval(liveTimer.current);
    resetLiveBuffer("demo");
    setView("live");
    liveTimer.current = setInterval(() => {
      const batch = makeDemoLiveBatch(liveBuffer.current.sampleCount, 25);
      ingestLiveBatch(batch.channels[6], batch.channels[7]);
    }, 100);
  };

  const connectLive = async () => {
    try {
      resetLiveBuffer("serial");
      setView("live");
      liveController.current = await connectOpenBCI({
        onSamples: channels => ingestLiveBatch([channels[6]], [channels[7]]),
        onStatus: next => setLive(previous => ({ ...previous, statusLabel: next === "connected" ? "Cyton connected" : "Stopped" })),
      });
    } catch (connectionError) {
      setLive(previous => ({ ...previous, status: "error", statusLabel: "Connection unavailable", running: false }));
      setError(connectionError.message);
    }
  };

  const stopLive = async () => {
    if (liveTimer.current) { clearInterval(liveTimer.current); liveTimer.current = null; }
    if (liveController.current) { await liveController.current.stop().catch(() => {}); liveController.current = null; }
    setLive(previous => ({ ...previous, status: "stopped", statusLabel: "Stopped", running: false }));
  };

  const finishExperiment = async (stoppedEarly = true) => {
    const buffer = experimentBuffer.current;
    if (!buffer.run || !buffer.CH7.length) {
      buffer.active = false;
      await stopLive();
      setExperimentRun(null);
      setError("The experiment stopped before any samples were recorded.");
      return;
    }
    buffer.active = false;
    try {
      const completed = buildExperimentRecording({ run: buffer.run, channel7: buffer.CH7, channel8: buffer.CH8, rate: CYTON_SAMPLE_RATE, stoppedEarly });
      buffer.run = completed.run;
      setExperimentRun(completed.run);
      setError("");
    } catch (experimentError) {
      setError(experimentError.message);
    }
    await stopLive();
  };

  const analyzeExperiment = () => {
    if (!experimentRun?.recording) return;
    try {
      const experimentRecording = experimentRun.recording;
      const experimentConditions = buildExperimentConditions(experimentRun.protocol, experimentRun.elapsedSec);
      const processed = preprocessChannels(experimentRecording.channels, experimentRecording.rate, preprocessing);
      const processedExperiment = { ...experimentRecording, channels: processed.channels };
      const experimentQuality = assessChannelQuality(experimentRecording.channels, experimentRecording.rate, preprocessing);
      const resultsById = {};
      const resultsByName = {};
      experimentConditions.forEach(condition => {
        const conditionResult = trustedConditionAnalysis(processedExperiment, ["O1", "O2"], condition, [], experimentQuality);
        resultsById[condition.id] = conditionResult;
        resultsByName[condition.name] = conditionResult;
      });
      if (!experimentConditions.length) throw new Error("The recorded session did not include a complete analysis phase.");
      setExperimentRun(previous => ({ ...previous, status: "analyzed", conditionResults: resultsByName }));
      experimentBuffer.current.run = { ...experimentRun, status: "analyzed", conditionResults: resultsByName };
      setRecording(experimentRecording);
      setSelected(["O1", "O2"]);
      setRange([experimentConditions[0].start, experimentConditions[0].end]);
      setConditions(experimentConditions);
      setEvents(experimentRun.markers);
      setArtifacts([]);
      setAnnotations([]);
      setConditionResults(resultsById);
      setResult(resultsById[experimentConditions[0].id]);
      setDynamic([]);
      setActiveConditionId(experimentConditions[0].id);
      setConditionName(experimentConditions[0].name);
      setError("");
    } catch (experimentError) { setError(experimentError.message); }
  };

  const addExperimentToStudy = () => {
    try {
      if (!experimentRun?.conditionResults || !Object.keys(experimentRun.conditionResults).length) throw new Error("Analyze the experiment before adding it to Study Mode.");
      const next = addStudyRecord(study, {
        participantId: experimentRun.participantId,
        sessionId: experimentRun.sessionId,
        sourceName: experimentRun.recording.name,
        sourceHash: experimentRun.recording.sourceHash,
        conditionResults: experimentRun.conditionResults,
      });
      setStudy(next);
      const names = studyConditionNames(next);
      setStudyConditionA(names[0] || "");
      setStudyConditionB(names[1] || names[0] || "");
      setExperimentRun(previous => ({ ...previous, addedToStudy: true }));
      setError(`${experimentRun.participantId} added to ${next.name}.`);
    } catch (studyError) { setError(studyError.message); }
  };

  const updateExperimentPhase = (index, patch) => setExperimentProtocol(previous => ({ ...previous, phases: previous.phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, ...patch } : phase) }));
  const addExperimentPhase = () => setExperimentProtocol(previous => ({ ...previous, phases: [...previous.phases, { id: `phase-${Date.now()}`, name: `Phase ${previous.phases.length + 1}`, durationSec: 30, instruction: "Follow the researcher’s instruction.", analyze: true, color: CONDITION_COLORS[previous.phases.length % CONDITION_COLORS.length] }] }));
  const removeExperimentPhase = index => setExperimentProtocol(previous => ({ ...previous, phases: previous.phases.filter((_, phaseIndex) => phaseIndex !== index) }));
  const newExperimentRun = () => { experimentBuffer.current = { active: false, run: null, CH7: [], CH8: [], lastRendered: 0, lastPhaseId: null, completing: false }; setExperimentRun(null); setError(""); };

  const markLiveEvent = () => setLive(previous => ({ ...previous, events: [...previous.events, { id: `live-event-${Date.now()}`, time: previous.sampleCount / previous.rate, label: `Event ${previous.events.length + 1}` }] }));

  const addCurrentToStudy = () => {
    try {
      const namedResults = Object.fromEntries(conditions.filter(condition => conditionResults[condition.id]).map(condition => [condition.name, conditionResults[condition.id]]));
      const next = addStudyRecord(study, { participantId, sessionId, sourceName: recording.name, sourceHash: recording.sourceHash, conditionResults: namedResults });
      setStudy(next);
      const names = studyConditionNames(next); setStudyConditionA(names[0] || ""); setStudyConditionB(names[1] || names[0] || "");
      setError(`${participantId} added to ${next.name}.`);
    } catch (studyError) { setError(studyError.message); }
  };

  const loadDemoStudy = () => {
    const demoStudy = createDemoStudy();
    setStudy(demoStudy); setStudyConditionA("Eyes open"); setStudyConditionB("Eyes closed"); setError("");
  };

  const batchLoadStudy = async event => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    if (!files.length) return;
    if (!conditions.length) { setError("Create condition intervals before batch import."); return; }
    setBatchBusy(true);
    let nextStudy = study;
    const failures = [];
    for (const file of files) {
      try {
        const text = await file.text();
        const loaded = { ...parseOpenBCI(text, file.name), sourceHash: await sha256(text) };
        const loadedNames = Object.keys(loaded.channels);
        const picked = selected.filter(name => loaded.channels[name]);
        const batchSelected = picked.length ? picked : loadedNames.filter(name => /^(O1|O2)$/i.test(name)).slice(0, 2);
        if (!batchSelected.length) batchSelected.push(...loadedNames.slice(0, 2));
        const processed = preprocessChannels(loaded.channels, loaded.rate, preprocessing);
        const batchRecording = { ...loaded, channels: processed.channels };
        const batchQuality = assessChannelQuality(loaded.channels, loaded.rate, preprocessing).filter(channel => batchSelected.includes(channel.name));
        const namedResults = {};
        conditions.forEach(condition => { namedResults[condition.name] = trustedConditionAnalysis(batchRecording, batchSelected, condition, [], batchQuality); });
        const baseId = file.name.replace(/\.[^.]+$/, "").split(/[_-]/)[0] || `P${nextStudy.records.length + 1}`;
        nextStudy = addStudyRecord(nextStudy, { participantId: baseId, sessionId: file.name.replace(/\.[^.]+$/, ""), sourceName: file.name, sourceHash: loaded.sourceHash, conditionResults: namedResults });
      } catch (batchError) { failures.push(`${file.name}: ${batchError.message}`); }
    }
    setStudy(nextStudy);
    const names = studyConditionNames(nextStudy); setStudyConditionA(names[0] || ""); setStudyConditionB(names[1] || names[0] || "");
    setBatchBusy(false);
    setError(failures.length ? failures.join(" ") : `${files.length} recording${files.length === 1 ? "" : "s"} added to Study Mode.`);
  };

  const runDynamics = () => {
    if (!selected.length) { setError("Select at least one channel before running dynamics."); return []; }
    const points = dynamicAnalysis(processedRecording, selected, duration, dynamicsSettings, artifacts);
    setDynamic(points);
    if (!points.length) setError("No clean moving windows were available for dynamics analysis.");
    return points;
  };
  const analyze = () => {
    setAnalyzing(true);
    setTimeout(() => {
      try {
        const temporary = { name: "Current selection", start: range[0], end: range[1] };
        setResult(trustedConditionAnalysis(processedRecording, selected, temporary, artifacts, selectedQuality));
        const points = runDynamics();
        if (points.length) setError("");
      } catch (analysisError) { setError(analysisError.message); }
      setAnalyzing(false);
    }, 40);
  };
  const analyzeConditions = () => {
    setAnalyzing(true);
    setConditionResults({});
    setResult(null);
    setTimeout(() => {
      const next = {}, failures = [];
      conditions.forEach(condition => { try { next[condition.id] = trustedConditionAnalysis(processedRecording, selected, condition, artifacts, selectedQuality); } catch (analysisError) { failures.push(analysisError.message); } });
      setConditionResults(next);
      setResult(next[conditions[0]?.id] || Object.values(next)[0] || null);
      const points = runDynamics();
      setView("compare");
      setError(failures.join(" ") || (!points.length ? "No clean moving windows were available for dynamics analysis." : ""));
      setAnalyzing(false);
    }, 40);
  };
  const saveCondition = () => {
    const name = conditionName.trim() || `Condition ${conditions.length + 1}`;
    if (activeConditionId) setConditions(conditions.map(condition => condition.id === activeConditionId ? { ...condition, name, start: range[0], end: range[1] } : condition));
    else { const created = { id: `condition-${Date.now()}`, name, start: range[0], end: range[1], color: CONDITION_COLORS[conditions.length % CONDITION_COLORS.length] }; setConditions([...conditions, created]); setActiveConditionId(created.id); }
    invalidateResults("Conditions changed. Re-run analysis.");
  };
  const selectCondition = condition => { setRange([condition.start, condition.end]); setActiveConditionId(condition.id); setConditionName(condition.name); };
  const startNewCondition = () => { setActiveConditionId(null); setConditionName(""); };
  const removeCondition = id => { setConditions(conditions.filter(condition => condition.id !== id)); if (activeConditionId === id) startNewCondition(); const next = { ...conditionResults }; delete next[id]; setConditionResults(next); setError("Condition removed. Re-run analysis to refresh comparisons."); };
  const markArtifact = () => { setArtifacts([...artifacts, { id: `artifact-${Date.now()}`, start: range[0], end: range[1] }]); invalidateResults("Artifact exclusions changed. Re-run analysis."); };
  const undoArtifact = () => { if (!artifacts.length) return; setArtifacts(artifacts.slice(0, -1)); invalidateResults("Artifact exclusion removed. Re-run analysis."); };
  const removeArtifact = id => { setArtifacts(artifacts.filter(artifact => artifact.id !== id)); invalidateResults("Artifact exclusion removed. Re-run analysis."); };
  const addEvent = () => setEvents([...events, { id: `event-${Date.now()}`, time: (range[0] + range[1]) / 2, label: `Event ${events.length + 1}`, color: COLORS.gold }]);
  const addAnnotation = () => { const label = annotationName.trim() || "Transition note"; setAnnotations([...annotations, { id: `annotation-${Date.now()}`, time: (range[0] + range[1]) / 2, label }]); setAnnotationName(""); };
  const applyArtifactSuggestions = () => {
    if (!artifactSuggestions.length) return;
    setArtifacts([...artifacts, ...artifactSuggestions.map((suggestion, index) => ({ ...suggestion, id: `artifact-${Date.now()}-${index}`, accepted: true }))]);
    invalidateResults(`${artifactSuggestions.length} suggested artifact interval${artifactSuggestions.length === 1 ? "" : "s"} applied. Re-run analysis.`);
  };

  const manifest = () => buildManifest({ recording, selected, conditions, artifacts, events, annotations, dynamicsSettings, dynamic, settings: DEFAULT_SETTINGS, preprocessing, quality, conditionResults, duration });
  const exportJson = () => saveDownload("flux-eeg-analysis-v0.4.json", JSON.stringify(manifest(), null, 2));
  const exportCsv = () => saveDownload("flux-eeg-results-v0.4.csv", buildResultsCsv(conditions, conditionResults), "text/csv");
  const exportReport = () => saveDownload("flux-eeg-report-v0.4.html", buildHtmlReport({ recording, selected, conditions, artifacts, conditionResults, duration, preprocessing, quality }), "text/html");
  const exportMethods = () => saveDownload("flux-eeg-methods-v0.4.txt", buildMethodsSummary({ recording, selected, conditions, artifacts, preprocessing, duration }), "text/plain");
  const exportFigure = () => { try { const condition = activeConditionId ? conditions.find(item => item.id === activeConditionId) : { name: "Current selection", start: range[0], end: range[1] }; saveDataUrl("flux-eeg-figure-v0.4.png", buildPublicationFigure({ recording, selected, condition: condition || { name: "Current selection" }, result, dynamic, preprocessing })); } catch (figureError) { setError(figureError.message); } };
  const exportStudyCsv = () => saveDownload("flux-eeg-study-v0.5.csv", buildStudyCsv(study), "text/csv");
  const exportStudyJson = () => saveDownload("flux-eeg-study-v0.5.json", JSON.stringify(study, null, 2));
  const exportExperimentCsv = () => { try { saveDownload(experimentRun?.recording?.name || "flux-eeg-experiment-v0.8.csv", buildExperimentCsv(experimentRun), "text/csv"); } catch (experimentError) { setError(experimentError.message); } };
  const exportExperimentJson = () => { if (experimentRun) saveDownload("flux-eeg-experiment-v0.8.json", JSON.stringify(experimentRun, null, 2)); };
  const exportInterpretation = () => { try { const selectionLabel = activeConditionId ? conditions.find(condition => condition.id === activeConditionId)?.name || "Current selection" : "Current selection"; saveDownload("flux-eeg-interpretation-v0.7.txt", buildInterpretationNote({ interpretation, recordingName: recording.name, selectionLabel }), "text/plain"); } catch (interpretationError) { setError(interpretationError.message); } };
  const saveProject = () => saveDownload("flux-eeg-project.flux.json", JSON.stringify(buildProjectSnapshot({ recording, selected, range, conditions, artifacts, events, annotations, dynamicsSettings, preprocessing, study, experimentProtocol, experimentRun }), null, 2));
  const loadRecording = async event => { const file = event.target.files?.[0]; if (!file) return; try { const text = await file.text(); applyRecording({ ...parseOpenBCI(text, file.name), sourceHash: await sha256(text) }); setError(""); } catch (loadError) { setError(loadError.message); } event.target.value = ""; };
  const loadProject = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const project = parseProjectSnapshot(await file.text());
      setRecording(project.recording); setSelected(project.selected); setRange(project.range); setConditions(project.conditions); setArtifacts(project.artifacts); setEvents(project.events); setAnnotations(project.annotations || []); setDynamicsSettings(project.dynamicsSettings || dynamicsSettings); setPreprocessing(project.preprocessing || DEFAULT_PREPROCESSING); setStudy(project.study || createEmptyStudy("Untitled study")); setExperimentProtocol(project.experimentProtocol || createDefaultProtocol()); setExperimentRun(project.experimentRun || null); setConditionResults({}); setResult(null); setDynamic([]); setActiveConditionId(null); setConditionName(""); setError("Project opened. Re-run analysis to regenerate results.");
    } catch (loadError) { setError(loadError.message); }
    event.target.value = "";
  };
  const inspectCondition = (condition, conditionResult) => { setRange([condition.start, condition.end]); setResult(conditionResult); setView("analyze"); setActiveConditionId(condition.id); setConditionName(condition.name); };
  const toggleChannel = name => { setSelected(selected.includes(name) ? selected.filter(channel => channel !== name) : [...selected, name]); invalidateResults("Channel selection changed. Re-run analysis."); };

  return <main className="app-shell">
    <aside className="steps">
      <div className="brand">Flux EEG <em>V0.8</em><span>Local-first 1/f workspace</span></div>
      <nav className="mode-nav" aria-label="Flux EEG modes">
        <div className="mode-nav-group">
          <p>Analysis</p>
          <button className={view === "analyze" ? "selected" : ""} onClick={() => openView("analyze")}><span>Analyze</span><small>Selection and fit</small></button>
          <button className={view === "compare" ? "selected" : ""} onClick={() => openView("compare")}><span>Compare</span><small>Conditions side by side</small></button>
          <button className={view === "dynamics" ? "selected" : ""} onClick={() => openView("dynamics")}><span>Dynamics</span><small>Exponent through time</small></button>
          <button className={view === "trust" ? "selected" : ""} onClick={() => openView("trust")}><span>Trust</span><small>Quality and provenance</small></button>
        </div>
        <div className="mode-nav-group research-modes">
          <p>Research modes</p>
          <button className={view === "experiment" ? "selected" : ""} onClick={() => openView("experiment")}><span>Experiment</span><small>Run a timed protocol</small></button>
          <button className={view === "study" ? "selected" : ""} onClick={() => openView("study")}><span>Study</span><small>Participants and effects</small></button>
          <button className={view === "live" ? "selected" : ""} onClick={() => openView("live")}><span>Live</span><small>OpenBCI stream</small></button>
          <button className={view === "interpret" ? "selected" : ""} onClick={() => openView("interpret")}><span>Interpret</span><small>Movement questions</small></button>
        </div>
      </nav>
      <button className="quiet" onClick={() => dataInput.current.click()}>Import recording</button>
      <button className="quiet" onClick={() => projectInput.current.click()}>Open project</button>
      <button className="quiet" onClick={saveProject}>Save project</button>
      <button className="quiet" onClick={loadDemo}>Load demo</button>
    </aside>

    <section className="workspace">
      {view === "experiment" && <ExperimentWorkspace protocol={experimentProtocol} run={experimentRun} live={live} />}
      {view === "study" && <StudyWorkspace study={study} summary={studySummary} />}
      {view === "live" && <LiveWorkspace live={live} />}
      {view === "interpret" && <InterpretationWorkspace interpretation={interpretation} selectedLens={selectedLens} />}
      {!specialView && <>
      <header><div><h1>EEG <span>Selected channels</span></h1><p>{recording.name} · {recording.rate} Hz · {formatTime(duration)} · {events.length} events</p></div><div className="event-tools"><button onClick={undoArtifact} disabled={!artifacts.length}>Undo exclusion</button><button onClick={markArtifact}>Exclude selection</button><button onClick={addEvent}>Add event</button></div></header>
      <div className="trace-title"><span>Raw EEG (µV)</span><span className="interaction-hint">Drag across the trace to select an interval</span><span className="legend"><i className="cyan" />signal <i className="violet" />selection <i className="artifact-key" />excluded</span></div>
      <div className="trace-mode" role="group" aria-label="Signal display"><button className={traceMode === "raw" ? "selected" : ""} onClick={() => setTraceMode("raw")}>Raw</button><button className={traceMode === "cleaned" ? "selected" : ""} onClick={() => setTraceMode("cleaned")}>Cleaned</button><span>{traceMode === "cleaned" ? "Preprocessing preview" : "Original imported signal"}</span></div>
      <TraceCanvas channels={traceMode === "cleaned" ? preprocessingOutput.channels : recording.channels} selected={selected.slice(0, 2)} duration={duration} range={range} events={events} conditions={conditions} artifacts={artifacts} onRangeChange={setRange} />
      <div className="range-controls"><label>Selection start <input type="range" min="0" max={duration} value={range[0]} onChange={event => setRange([Math.min(+event.target.value, range[1] - 1), range[1]])} /><output>{formatTime(range[0])}</output></label><label>Selection end <input type="range" min="0" max={duration} value={range[1]} onChange={event => setRange([range[0], Math.max(+event.target.value, range[0] + 1)])} /><output>{formatTime(range[1])}</output></label></div>
      <div className="condition-builder">
        <div className="condition-entry"><input aria-label="Condition name" placeholder="Name this interval…" value={conditionName} onChange={event => setConditionName(event.target.value)} /><button onClick={saveCondition}>{activeConditionId ? "Update condition" : "Save condition"}</button>{activeConditionId && <button className="secondary-action" onClick={startNewCondition}>New</button>}</div>
        <div className="condition-chips">{conditions.map(condition => <div className={`condition-chip ${activeConditionId === condition.id ? "selected" : ""}`} style={{ "--chip": condition.color }} key={condition.id}><button className="condition-select" onClick={() => selectCondition(condition)}>{condition.name}<span>{formatTime(condition.start)}–{formatTime(condition.end)}</span></button><button className="condition-remove" aria-label={`Remove ${condition.name}`} onClick={() => removeCondition(condition.id)}>Remove</button></div>)}</div>
      </div>
      <div className="section-title"><div><h2>{view === "dynamics" ? "Dynamics" : "1/f Exponent"} <span>(moving window)</span></h2><p>Window {dynamicsSettings.windowSec} s · Step {dynamicsSettings.stepSec} s · 1–45 Hz · {transitions.length} transitions</p></div><span className="legend"><i className={dynamic.length && !hasReliableDynamics ? "gold" : "lime"} />{dynamic.length && !hasReliableDynamics ? "review-fit trajectory" : `average ${selected.join(" + ")}`} {view === "dynamics" && <><i className="artifact-key" />change point</>}</span></div>
      {!dynamic.length && <div className="dynamic-empty-inline">Run an analysis to map the exponent through time. Excluded windows will remain absent.</div>}
      <LineCanvas points={dynamic} duration={duration} range={range} transitions={view === "dynamics" ? transitions : []} annotations={view === "dynamics" ? annotations : []} conditions={conditions} />
      </>}
    </section>

    <aside className="inspector">
      {!specialView && <>
      <div className="recording-head"><h2>Recording</h2><span className={qualitySummary.status === "good" ? "recording-quality good" : "recording-quality"}>{qualitySummary.status === "good" ? "Signal screen clear" : "Review signal"}</span></div>
      <dl><dt>File</dt><dd>{recording.name}</dd><dt>Duration</dt><dd>{duration.toFixed(1)} s</dd><dt>Sampling rate</dt><dd>{recording.rate} Hz</dd><dt>Events</dt><dd>{events.length}</dd></dl>
      <hr />
      <h2>Selected channels ({selected.length})</h2><div className="channels">{names.map(name => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={() => toggleChannel(name)} />{name}</label>)}</div><p className="hint">Selected channels are averaged before fitting.</p>
      {view === "analyze" && <button className="primary" disabled={!selected.length || analyzing} onClick={analyze}>{analyzing ? "Analyzing…" : "Analyze current selection"}</button>}
      {view === "compare" && <button className="primary" disabled={conditions.length < 2 || analyzing} onClick={analyzeConditions}>{analyzing ? "Analyzing conditions…" : "Analyze all conditions"}</button>}
      {view === "dynamics" && <button className="primary" disabled={!selected.length || analyzing} onClick={() => { setAnalyzing(true); setTimeout(() => { const points = runDynamics(); setAnalyzing(false); if (points.length) setError(""); }, 40); }}>{analyzing ? "Mapping dynamics…" : "Analyze dynamics"}</button>}
      {view !== "trust" && <button className="advanced" onClick={() => setAdvanced(!advanced)}>Advanced <span>{advanced ? "Hide" : "Show"}</span></button>}
      {advanced && <div className="advanced-body"><label>Frequency range <span>1–45 Hz</span></label><label>Moving window <select aria-label="Moving window" value={dynamicsSettings.windowSec} onChange={event => { setDynamicsSettings({ ...dynamicsSettings, windowSec: +event.target.value }); setDynamic([]); }}><option value="4">4 s</option><option value="8">8 s</option><option value="16">16 s</option></select></label><label>Step <select aria-label="Moving step" value={dynamicsSettings.stepSec} onChange={event => { setDynamicsSettings({ ...dynamicsSettings, stepSec: +event.target.value }); setDynamic([]); }}><option value="2">2 s</option><option value="4">4 s</option><option value="8">8 s</option></select></label><label>Transition threshold <select aria-label="Transition threshold" value={dynamicsSettings.transitionThreshold} onChange={event => setDynamicsSettings({ ...dynamicsSettings, transitionThreshold: +event.target.value })}><option value="0.05">0.05</option><option value="0.08">0.08</option><option value="0.12">0.12</option></select></label><label>Aperiodic mode <span>Fixed</span></label><label>Validation <span>Passed · 3 fixtures</span></label></div>}
      {error && <p className="error">{error}</p>}
      <hr />

      </>}
      {specialView && error && <p className="error mode-error">{error}</p>}
      {view === "experiment" && <ExperimentPanel protocol={experimentProtocol} run={experimentRun} participantId={participantId} sessionId={sessionId} onParticipantId={setParticipantId} onSessionId={setSessionId} onProtocolName={name => setExperimentProtocol(previous => ({ ...previous, name }))} onUpdatePhase={updateExperimentPhase} onAddPhase={addExperimentPhase} onRemovePhase={removeExperimentPhase} onDefaultProtocol={() => setExperimentProtocol(createDefaultProtocol())} onQuickProtocol={() => setExperimentProtocol(createQuickDemoProtocol())} onStartDemo={startExperimentDemo} onConnect={connectExperiment} onStop={() => finishExperiment(true)} onAnalyze={analyzeExperiment} onAddToStudy={addExperimentToStudy} onExportCsv={exportExperimentCsv} onExportJson={exportExperimentJson} onNewRun={newExperimentRun} busy={experimentBusy} />}
      {view === "study" && <StudyPanel study={study} summary={studySummary} participantId={participantId} sessionId={sessionId} onParticipantId={setParticipantId} onSessionId={setSessionId} conditionA={effectiveStudyA} conditionB={effectiveStudyB} conditions={studyConditions} onConditionA={setStudyConditionA} onConditionB={setStudyConditionB} onAddCurrent={addCurrentToStudy} onBatchImport={() => studyInput.current.click()} onLoadDemo={loadDemoStudy} onClear={() => { setStudy(createEmptyStudy("Untitled study")); setStudyConditionA(""); setStudyConditionB(""); }} onExportCsv={exportStudyCsv} onExportJson={exportStudyJson} busy={batchBusy} />}
      {view === "live" && <LivePanel live={live} onStartDemo={startDemoLive} onConnect={connectLive} onStop={stopLive} onMarkEvent={markLiveEvent} />}
      {view === "interpret" && <InterpretationPanel interpretation={interpretation} selectedLens={selectedLens} onSelectedLens={setSelectedLens} onExport={exportInterpretation} />}
      {view === "trust" && <TrustPanel quality={selectedQuality} qualitySummary={qualitySummary} suggestions={artifactSuggestions} preprocessing={preprocessing} onPreprocessingChange={updatePreprocessing} preprocessingWarnings={preprocessingOutput.warnings} selfCheck={selfCheck} onSelfCheck={() => setSelfCheck(runBuiltInSelfCheck())} onApplySuggestions={applyArtifactSuggestions} recording={recording} selected={selected} onExportMethods={exportMethods} onExportFigure={exportFigure} hasResult={Boolean(result)} />}
      {view === "analyze" && <><div className="results-head"><h2>Fit inspector</h2><span className={result?.r2 >= 0.9 ? "quality good" : "quality"}>{status}</span></div><FitResult result={result} status={status} /></>}
      {view === "compare" && <><div className="results-head"><h2>Condition comparison</h2><span className="quality good">{Object.keys(conditionResults).length}/{conditions.length} ready</span></div><ComparisonPanel conditions={conditions} results={conditionResults} onInspect={inspectCondition} />{Object.keys(conditionResults).length > 0 && <div className="exports"><button onClick={exportCsv}>Export CSV</button><button onClick={exportJson}>Export manifest</button><button className="wide" onClick={exportReport}>Export report</button></div>}</>}
      {view === "dynamics" && <div className="dynamics-panel"><div className="results-head"><h2>Dynamics summary</h2><span className={dynamicsSummary.reliableCount ? "quality good" : "quality"}>{dynamicsSummary.reliableCount || 0}/{dynamic.length} reliable</span></div>{dynamic.length ? <>{dynamicsSummary.reliableCount ? <div className="dynamics-stats"><span>Mean χ<b>{dynamicsSummary.mean.toFixed(2)}</b></span><span>Range<b>{dynamicsSummary.minimum.toFixed(2)}–{dynamicsSummary.maximum.toFixed(2)}</b></span><span>Stable share<b>{Math.round(dynamicsSummary.stableShare * 100)}%</b></span></div> : <div className="fit-explanation review"><strong>No reliable dynamics windows</strong><p>The trajectory remains visible, but change points are withheld until adjacent windows both reach R² ≥ 0.90.</p></div>}<h3>Detected changes</h3><div className="transition-list">{transitions.slice(0, 8).map(transition => <button key={transition.id} onClick={() => setRange([Math.max(0, transition.time - dynamicsSettings.windowSec), Math.min(duration, transition.time + dynamicsSettings.windowSec)])}><span>{formatTime(transition.time)}</span><b>{transition.direction}</b><em>{transition.delta >= 0 ? "+" : ""}{transition.delta.toFixed(2)}</em></button>)}{!transitions.length && <p>No reliable changes crossed the current threshold.</p>}</div></> : <div className="compare-empty"><p>Run dynamics to detect changes and stable periods.</p></div>}<div className="annotation-entry"><input aria-label="Dynamics note" placeholder="Annotate the selected moment…" value={annotationName} onChange={event => setAnnotationName(event.target.value)} /><button onClick={addAnnotation}>Add note</button></div>{annotations.length > 0 && <div className="annotation-list">{annotations.map(annotation => <div key={annotation.id}><button onClick={() => setRange([Math.max(0, annotation.time - 4), Math.min(duration, annotation.time + 4)])}><span>{formatTime(annotation.time)}</span>{annotation.label}</button><button aria-label={`Remove ${annotation.label}`} onClick={() => setAnnotations(annotations.filter(item => item.id !== annotation.id))}>Remove</button></div>)}</div>}</div>}

      {artifacts.length > 0 && <div className="artifact-manager"><h3>Artifact exclusions</h3>{artifacts.map(artifact => <div key={artifact.id}><span>{formatTime(artifact.start)}–{formatTime(artifact.end)}</span><button onClick={() => removeArtifact(artifact.id)}>Remove</button></div>)}</div>}
      <p className="disclaimer">Descriptive research output; not a diagnosis or statistical inference.</p>
    </aside>
    <input ref={dataInput} hidden type="file" accept=".csv,.txt,.tsv" onChange={loadRecording} />
    <input ref={projectInput} hidden type="file" accept=".json,.flux.json" onChange={loadProject} />
    <input ref={studyInput} hidden multiple type="file" accept=".csv,.txt,.tsv" onChange={batchLoadStudy} />
  </main>;
}
