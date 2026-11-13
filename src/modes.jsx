import { useEffect, useRef } from "react";
import { FRAMEWORK_SOURCES } from "./interpretation.js";
import { phaseAtElapsed, protocolDuration, protocolTimeline } from "./experiment.js";

const CHART = { background: "#081827", grid: "#2a3d4e", cyan: "#27b6ee", lime: "#9ddd3b", violet: "#8d6bc7", gold: "#d8a653", muted: "#90a6b6", text: "#e7f0f6" };

function prepareCanvas(canvas) {
  const context = canvas.getContext("2d");
  const ratio = devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  context.scale(ratio, ratio);
  context.clearRect(0, 0, width, height);
  return { context, width, height };
}

export function StudyCanvas({ summary }) {
  const ref = useRef(null);
  useEffect(() => {
    const { context, width, height } = prepareCanvas(ref.current);
    const left = 82, right = 48, top = 34, bottom = 54;
    context.fillStyle = CHART.background; context.fillRect(0, 0, width, height);
    if (!summary?.paired?.length) { context.fillStyle = CHART.muted; context.font = "13px Inter"; context.fillText("Load or add paired participant data to see the study plot.", left, height / 2); return; }
    const values = summary.paired.flatMap(item => [item.first, item.second]);
    const minimum = Math.min(...values) - 0.12, maximum = Math.max(...values) + 0.12;
    const xA = width * 0.34, xB = width * 0.72;
    const y = value => top + (maximum - value) / Math.max(0.1, maximum - minimum) * (height - top - bottom);
    context.strokeStyle = CHART.grid; context.fillStyle = CHART.muted; context.font = "10px Inter";
    for (let index = 0; index <= 4; index += 1) { const value = minimum + index * (maximum - minimum) / 4; context.beginPath(); context.moveTo(left, y(value)); context.lineTo(width - right, y(value)); context.stroke(); context.fillText(value.toFixed(2), 33, y(value) + 4); }
    summary.paired.forEach((item, index) => {
      context.strokeStyle = "rgba(120,155,180,.5)"; context.lineWidth = 1; context.beginPath(); context.moveTo(xA, y(item.first)); context.lineTo(xB, y(item.second)); context.stroke();
      context.fillStyle = CHART.cyan; context.beginPath(); context.arc(xA, y(item.first), 4, 0, Math.PI * 2); context.fill();
      context.fillStyle = CHART.violet; context.beginPath(); context.arc(xB, y(item.second), 4, 0, Math.PI * 2); context.fill();
    });
    context.strokeStyle = CHART.lime; context.lineWidth = 4; context.beginPath(); context.moveTo(xA - 22, y(summary.meanA)); context.lineTo(xA + 22, y(summary.meanA)); context.stroke(); context.beginPath(); context.moveTo(xB - 22, y(summary.meanB)); context.lineTo(xB + 22, y(summary.meanB)); context.stroke();
    context.fillStyle = CHART.text; context.font = "600 12px Inter"; context.fillText(summary.conditionA, xA - 35, height - 24); context.fillText(summary.conditionB, xB - 35, height - 24);
  }, [summary]);
  return <canvas ref={ref} className="study-chart" aria-label="Paired participant exponent comparison" />;
}

export function StudyWorkspace({ study, summary }) {
  return <div className="mode-workspace study-workspace">
    <header><div><h1>Study Mode <span>paired participant analysis</span></h1><p>{study.name} · {summary.participants} participants · {summary.records} recordings</p></div><span className="mode-badge">V0.5</span></header>
    <div className="mode-intro"><strong>Group structure without hiding the individuals</strong><p>Each line is one participant average. Repeated sessions are averaged within participant before the paired difference is calculated.</p></div>
    <div className="study-stat-grid"><div><span>{summary.conditionA}</span><b>{summary.meanA.toFixed(2)}</b><em>group mean χ</em></div><div><span>{summary.conditionB}</span><b>{summary.meanB.toFixed(2)}</b><em>group mean χ</em></div><div><span>Paired change</span><b>{summary.meanDifference >= 0 ? "+" : ""}{summary.meanDifference.toFixed(2)}</b><em>mean Δχ</em></div><div><span>Effect size</span><b>{summary.dz.toFixed(2)}</b><em>Cohen's dz · {summary.magnitude}</em></div></div>
    <div className="mode-section-title"><div><h2>Participant trajectories</h2><p>Approx. 95% CI for mean paired change: {summary.ci95[0].toFixed(2)} to {summary.ci95[1].toFixed(2)}</p></div><span>{summary.pairedCount} complete pairs</span></div>
    <StudyCanvas summary={summary} />
    <p className="mode-footnote">Effect sizes summarize this sample; they do not establish statistical significance, causation, or population generality.</p>
  </div>;
}

export function StudyPanel({ study, summary, participantId, sessionId, onParticipantId, onSessionId, conditionA, conditionB, conditions, onConditionA, onConditionB, onAddCurrent, onBatchImport, onLoadDemo, onClear, onExportCsv, onExportJson, busy }) {
  return <div className="study-panel">
    <div className="results-head"><h2>Study dataset</h2><span className="quality good">{summary.participants} participants</span></div>
    <p className="panel-copy">Add the current analyzed conditions or batch-process recordings with the same interval definitions.</p>
    <div className="study-entry"><label>Participant ID<input value={participantId} onChange={event => onParticipantId(event.target.value)} placeholder="P09" /></label><label>Session<input value={sessionId} onChange={event => onSessionId(event.target.value)} placeholder="Rest 01" /></label></div>
    <button className="primary" onClick={onAddCurrent}>Add current results</button>
    <button className="mode-secondary" disabled={busy} onClick={onBatchImport}>{busy ? "Processing files…" : "Batch import recordings"}</button>
    <button className="mode-secondary" onClick={onLoadDemo}>Load demo study</button>
    <hr />
    <div className="study-pair"><label>Condition A<select aria-label="Study condition A" value={conditionA} onChange={event => onConditionA(event.target.value)}>{conditions.map(name => <option key={name}>{name}</option>)}</select></label><label>Condition B<select aria-label="Study condition B" value={conditionB} onChange={event => onConditionB(event.target.value)}>{conditions.map(name => <option key={name}>{name}</option>)}</select></label></div>
    <div className="paired-summary"><span>Complete pairs<b>{summary.pairedCount}</b></span><span>Mean Δχ<b>{summary.meanDifference >= 0 ? "+" : ""}{summary.meanDifference.toFixed(2)}</b></span><span>Cohen's dz<b>{summary.dz.toFixed(2)}</b></span></div>
    <div className="study-records"><h3>Records ({study.records.length})</h3>{study.records.slice(-8).reverse().map(record => <div key={record.id}><b>{record.participantId}</b><span>{record.sessionId}</span><em>{Object.keys(record.conditionResults).length} conditions</em></div>)}</div>
    <div className="exports"><button onClick={onExportCsv}>Export study CSV</button><button onClick={onExportJson}>Export study JSON</button><button className="wide" onClick={onClear}>Clear study</button></div>
  </div>;
}

export function LiveTraceCanvas({ channels, seconds = 30, rate = 250 }) {
  const ref = useRef(null);
  useEffect(() => {
    const { context, width, height } = prepareCanvas(ref.current);
    const left = 66, right = 18, top = 24, bottom = 30, plotWidth = width - left - right;
    context.strokeStyle = CHART.grid; context.fillStyle = CHART.muted; context.font = "10px Inter";
    for (let index = 0; index <= 6; index += 1) { const x = left + index * plotWidth / 6; context.beginPath(); context.moveTo(x, top); context.lineTo(x, height - bottom); context.stroke(); context.fillText(`${Math.round(index * seconds / 6 - seconds)}s`, x - 10, height - 9); }
    [channels.CH7 || [], channels.CH8 || []].forEach((values, channelIndex) => {
      const visible = values.slice(-seconds * rate);
      const center = channelIndex ? height * 0.7 : height * 0.32;
      const maximum = Math.max(20, ...visible.map(Math.abs));
      const scale = 52 / maximum;
      context.strokeStyle = CHART.cyan; context.lineWidth = 1; context.beginPath();
      visible.forEach((value, index) => { const x = left + index / Math.max(1, visible.length - 1) * plotWidth; const y = center - value * scale; index ? context.lineTo(x, y) : context.moveTo(x, y); }); context.stroke();
      context.fillStyle = CHART.text; context.font = "14px Inter"; context.fillText(channelIndex ? "CH8" : "CH7", 18, center + 4);
    });
  }, [channels, seconds, rate]);
  return <canvas ref={ref} className="live-trace" aria-label="Rolling live OpenBCI signal" />;
}

export function LiveExponentCanvas({ points }) {
  const ref = useRef(null);
  useEffect(() => {
    const { context, width, height } = prepareCanvas(ref.current);
    const left = 66, right = 18, top = 20, bottom = 30;
    const visible = points.slice(-60);
    const values = visible.map(point => point.exponent);
    const minimum = values.length ? Math.min(...values) - 0.1 : 1;
    const maximum = values.length ? Math.max(...values) + 0.1 : 2.5;
    const x = index => left + index / Math.max(1, visible.length - 1) * (width - left - right);
    const y = value => top + (maximum - value) / Math.max(0.2, maximum - minimum) * (height - top - bottom);
    context.strokeStyle = CHART.grid; context.fillStyle = CHART.muted; context.font = "10px Inter";
    for (let index = 0; index <= 4; index += 1) { const value = minimum + index * (maximum - minimum) / 4; context.beginPath(); context.moveTo(left, y(value)); context.lineTo(width - right, y(value)); context.stroke(); context.fillText(value.toFixed(2), 25, y(value) + 4); }
    context.strokeStyle = CHART.lime; context.lineWidth = 2; context.beginPath(); visible.forEach((point, index) => index ? context.lineTo(x(index), y(point.exponent)) : context.moveTo(x(index), y(point.exponent))); context.stroke();
    visible.forEach((point, index) => { context.fillStyle = point.r2 >= 0.9 ? CHART.lime : CHART.gold; context.beginPath(); context.arc(x(index), y(point.exponent), 3, 0, Math.PI * 2); context.fill(); });
  }, [points]);
  return <canvas ref={ref} className="live-exponent" aria-label="Rolling live exponent estimates" />;
}

export function LiveWorkspace({ live }) {
  return <div className="mode-workspace live-workspace">
    <header><div><h1>Live Mode <span>OpenBCI stream</span></h1><p>{live.statusLabel} · {live.sampleCount.toLocaleString()} samples · CH7 + CH8</p></div><span className={`live-indicator ${live.running ? "running" : ""}`}>{live.running ? "Streaming" : "Stopped"}</span></header>
    <div className="live-head"><span>Rolling signal</span><span>{live.rate} Hz · last 30 seconds</span></div>
    <LiveTraceCanvas channels={live.channels} rate={live.rate} />
    <div className="live-metrics"><div><span>Current χ</span><b>{live.current?.exponent?.toFixed(2) || "—"}</b></div><div><span>Fit R²</span><b>{live.current?.r2?.toFixed(2) || "—"}</b></div><div><span>Alpha</span><b>{live.current?.alphaCF ? `${live.current.alphaCF.toFixed(1)} Hz` : "—"}</b></div><div><span>Reliable windows</span><b>{live.points.filter(point => point.r2 >= 0.9).length}/{live.points.length}</b></div></div>
    <div className="mode-section-title"><div><h2>Exponent through the experiment</h2><p>8-second rolling window · estimates update every 2 seconds</p></div><span>Gold points require review</span></div>
    <LiveExponentCanvas points={live.points} />
    <p className="mode-footnote">Live values are provisional monitoring estimates. Save the recording and rerun the offline Trust workflow before using them in research claims.</p>
  </div>;
}

export function LivePanel({ live, onStartDemo, onConnect, onStop, onMarkEvent }) {
  return <div className="live-panel">
    <div className="results-head"><h2>Live connection</h2><span className={live.running ? "quality good" : "quality"}>{live.statusLabel}</span></div>
    <div className="connection-card"><span>{live.source === "serial" ? "OpenBCI Cyton" : live.source === "demo" ? "Simulated Cyton" : "No source"}</span><strong>{live.running ? `${live.rate} samples/second` : "Ready to connect"}</strong><p>Posterior monitor uses board channels 7 and 8. Hardware packets are decoded locally in the browser.</p></div>
    {!live.running ? <><button className="primary" onClick={onConnect}>Connect OpenBCI</button><button className="mode-secondary" onClick={onStartDemo}>Start demo stream</button></> : <><button className="primary stop" onClick={onStop}>Stop stream</button><button className="mode-secondary" onClick={onMarkEvent}>Mark live event</button></>}
    <hr />
    <h3>Connection requirements</h3>
    <div className="requirements"><p><b>Board</b><span>OpenBCI Cyton, 8 channels</span></p><p><b>Baud</b><span>115200</span></p><p><b>Browser</b><span>Chrome or Edge with Web Serial</span></p><p><b>Privacy</b><span>Local device stream</span></p></div>
    <div className="live-events"><h3>Live events ({live.events.length})</h3>{live.events.slice(-6).reverse().map(event => <div key={event.id}><span>{event.time.toFixed(1)} s</span><b>{event.label}</b></div>)}</div>
    <div className="fit-explanation review"><strong>Monitoring only</strong><p>Live estimates are intentionally separated from validated offline analysis and export.</p></div>
  </div>;
}

function formatClock(seconds) {
  const rounded = Math.max(0, Math.ceil(seconds || 0));
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

function ExperimentTimeline({ protocol, elapsedSec = 0 }) {
  const timeline = protocolTimeline(protocol);
  const total = protocolDuration(protocol);
  return <div className="experiment-timeline" aria-label="Experiment protocol timeline">
    {timeline.map(phase => {
      const completed = elapsedSec >= phase.end;
      const active = elapsedSec >= phase.start && elapsedSec < phase.end;
      return <div className={`${completed ? "complete" : ""} ${active ? "active" : ""}`} style={{ "--phase": phase.color, "--phase-width": `${phase.durationSec / total * 100}%` }} key={phase.id}>
        <span>{phase.name}</span><small>{formatClock(phase.durationSec)}</small>
      </div>;
    })}
  </div>;
}

export function ExperimentWorkspace({ protocol, run, live }) {
  const total = protocolDuration(protocol);
  const elapsed = run?.elapsedSec || 0;
  const current = phaseAtElapsed(protocol, elapsed);
  const running = run?.status === "running";
  const complete = ["complete", "analyzed"].includes(run?.status);
  const results = Object.entries(run?.conditionResults || {});
  const phaseRemaining = current ? Math.max(0, current.end - elapsed) : 0;
  const overallProgress = Math.min(100, elapsed / Math.max(1, total) * 100);

  return <div className="mode-workspace experiment-workspace">
    <header><div><h1>Experiment Mode <span>guided protocol runner</span></h1><p>{protocol.name} · {protocol.phases.length} phases · {formatClock(total)}</p></div><span className={`experiment-status ${running ? "running" : complete ? "complete" : ""}`}>{running ? "Running" : complete ? run.status === "analyzed" ? "Analyzed" : "Complete" : "Setup"}</span></header>

    {!running && !complete && <>
      <div className="mode-intro experiment-intro"><strong>One continuous path from protocol to study</strong><p>Flux runs timed instructions, writes phase markers automatically, records posterior channels locally, and prepares each analysis phase for the trusted offline workflow.</p></div>
      <div className="experiment-stat-grid"><div><span>Total duration</span><b>{formatClock(total)}</b><em>planned run</em></div><div><span>Protocol phases</span><b>{protocol.phases.length}</b><em>{protocol.phases.filter(phase => phase.analyze).length} analyzed</em></div><div><span>Recording</span><b>O1 + O2</b><em>Cyton CH7 + CH8</em></div><div><span>Storage</span><b>Local</b><em>raw samples retained</em></div></div>
      <div className="mode-section-title"><div><h2>Protocol timeline</h2><p>Every phase boundary becomes an event marker.</p></div><span>Editable in the inspector</span></div>
      <ExperimentTimeline protocol={protocol} />
      <div className="experiment-flow"><div><b>1</b><strong>Prepare</strong><p>Participant, session, phases, and instructions.</p></div><div><b>2</b><strong>Run</strong><p>Timed prompts with a local Cyton or simulated stream.</p></div><div><b>3</b><strong>Analyze</strong><p>Offline fits become a study-ready participant record.</p></div></div>
    </>}

    {running && <>
      <div className="experiment-focus" style={{ "--phase": current?.color || CHART.cyan }}><span>Current phase · {current?.index + 1} of {protocol.phases.length}</span><h2>{current?.name}</h2><p>{current?.instruction}</p><b>{formatClock(phaseRemaining)}</b><small>remaining in phase</small></div>
      <div className="experiment-progress"><div><span style={{ width: `${overallProgress}%` }} /></div><p><b>{formatClock(elapsed)}</b> elapsed <span>{formatClock(Math.max(0, total - elapsed))} remaining</span></p></div>
      <ExperimentTimeline protocol={protocol} elapsedSec={elapsed} />
      <div className="live-head"><span>Recorded posterior signal</span><span>{live.rate} Hz · CH7 + CH8</span></div>
      <LiveTraceCanvas channels={live.channels} rate={live.rate} />
      <p className="mode-footnote">Automatic prompts and markers do not replace researcher supervision. Stop the run if the participant is uncomfortable or the signal becomes unusable.</p>
    </>}

    {complete && <>
      <div className="experiment-complete"><span>{run.stoppedEarly ? "Stopped early" : "Protocol complete"}</span><h2>{run.participantId} · {run.sessionId}</h2><p>{formatClock(run.elapsedSec)} recorded · {run.recording?.channels?.O1?.length?.toLocaleString() || 0} samples/channel · {run.markers.length} automatic markers</p></div>
      <div className="mode-section-title"><div><h2>Recorded timeline</h2><p>The raw recording remains local and can be exported before analysis.</p></div><span>{run.source === "serial" ? "OpenBCI Cyton" : "Simulated Cyton"}</span></div>
      <ExperimentTimeline protocol={run.protocol} elapsedSec={run.elapsedSec} />
      {results.length ? <><div className="mode-section-title"><div><h2>Offline condition results</h2><p>Welch PSD and the trusted fixed-mode fitting pipeline.</p></div><span>{results.length} conditions analyzed</span></div><div className="experiment-results"><div className="labels"><span>Condition</span><span>χ</span><span>R²</span><span>Alpha</span></div>{results.map(([name, result]) => <div key={name}><b>{name}</b><span>{result.exponent.toFixed(2)}</span><span className={result.r2 >= 0.9 ? "fit-good" : "fit-review"}>{result.r2.toFixed(2)}</span><span>{result.alphaCF ? `${result.alphaCF.toFixed(1)} Hz` : "—"}</span></div>)}</div></> : <div className="experiment-analysis-ready"><strong>Recording ready for offline analysis</strong><p>Run analysis from the inspector to create condition fits before adding this participant to Study Mode.</p></div>}
      <p className="mode-footnote">A completed protocol is not automatically a valid observation. Review artifacts, signal quality, fit warnings, and protocol deviations before using the record.</p>
    </>}
  </div>;
}

export function ExperimentPanel({ protocol, run, participantId, sessionId, onParticipantId, onSessionId, onProtocolName, onUpdatePhase, onAddPhase, onRemovePhase, onDefaultProtocol, onQuickProtocol, onStartDemo, onConnect, onStop, onAnalyze, onAddToStudy, onExportCsv, onExportJson, onNewRun, busy }) {
  const running = run?.status === "running";
  const complete = ["complete", "analyzed"].includes(run?.status);
  return <div className="experiment-panel">
    <div className="results-head"><h2>Experiment session</h2><span className={running ? "quality good" : "quality"}>{running ? "Recording" : complete ? "Captured" : "Ready"}</span></div>
    {!running && !complete && <>
      <p className="panel-copy">Set the participant and protocol, then choose a simulated rehearsal or direct Cyton connection.</p>
      <div className="study-entry"><label>Participant ID<input value={participantId} onChange={event => onParticipantId(event.target.value)} /></label><label>Session<input value={sessionId} onChange={event => onSessionId(event.target.value)} /></label></div>
      <label className="experiment-name">Protocol name<input value={protocol.name} onChange={event => onProtocolName(event.target.value)} /></label>
      <div className="protocol-editor"><div className="protocol-editor-head"><h3>Phases</h3><span>{formatClock(protocolDuration(protocol))}</span></div>{protocol.phases.map((phase, index) => <div className="protocol-row" key={phase.id}>
        <input aria-label={`Phase ${index + 1} name`} value={phase.name} onChange={event => onUpdatePhase(index, { name: event.target.value })} />
        <label>Seconds<input aria-label={`${phase.name} duration`} type="number" min="1" max="3600" value={phase.durationSec} onChange={event => onUpdatePhase(index, { durationSec: +event.target.value })} /></label>
        <input className="instruction" aria-label={`${phase.name} instruction`} value={phase.instruction} onChange={event => onUpdatePhase(index, { instruction: event.target.value })} />
        <label className="analysis-check"><input type="checkbox" checked={phase.analyze} onChange={event => onUpdatePhase(index, { analyze: event.target.checked })} />Analyze</label>
        <button aria-label={`Remove ${phase.name}`} disabled={protocol.phases.length === 1} onClick={() => onRemovePhase(index)}>Remove</button>
      </div>)}</div>
      <button className="mode-secondary" onClick={onAddPhase}>Add phase</button>
      <div className="experiment-presets"><button onClick={onDefaultProtocol}>Resting-state preset</button><button onClick={onQuickProtocol}>Quick demo preset</button></div>
      <hr />
      <button className="primary" disabled={busy} onClick={onConnect}>{busy ? "Connecting…" : "Connect Cyton and run"}</button>
      <button className="mode-secondary" onClick={onStartDemo}>Rehearse with simulator</button>
      <div className="fit-explanation review"><strong>Researcher check</strong><p>Confirm electrode contact, participant comfort, protocol timing, and data-storage consent before starting a real session.</p></div>
    </>}
    {running && <>
      <div className="connection-card"><span>{run.source === "serial" ? "OpenBCI Cyton" : "Simulated Cyton"}</span><strong>{run.participantId} · {run.sessionId}</strong><p>{run.protocol.name} is recording locally with automatic phase markers.</p></div>
      <button className="primary stop" onClick={onStop}>Stop experiment</button>
      <div className="requirements"><p><b>Elapsed</b><span>{formatClock(run.elapsedSec)}</span></p><p><b>Current phase</b><span>{phaseAtElapsed(run.protocol, run.elapsedSec)?.name}</span></p><p><b>Markers</b><span>{run.markers.length}</span></p><p><b>Samples</b><span>{Math.round(run.elapsedSec * run.rate).toLocaleString()}</span></p></div>
    </>}
    {complete && <>
      <div className="connection-card"><span>{run.stoppedEarly ? "Partial session" : "Session complete"}</span><strong>{run.participantId} · {run.sessionId}</strong><p>{formatClock(run.elapsedSec)} captured locally from {run.source === "serial" ? "OpenBCI Cyton" : "the simulator"}.</p></div>
      {run.status !== "analyzed" ? <button className="primary" onClick={onAnalyze}>Analyze recorded conditions</button> : <button className="primary" disabled={run.addedToStudy} onClick={onAddToStudy}>{run.addedToStudy ? "Added to Study Mode" : "Add participant to study"}</button>}
      <div className="exports"><button onClick={onExportCsv}>Export raw CSV</button><button onClick={onExportJson}>Export session JSON</button><button className="wide" onClick={onNewRun}>Start a new session</button></div>
      <div className="fit-explanation review"><strong>Review before inclusion</strong><p>Inspect signal quality and fit diagnostics before treating the session as a usable study observation.</p></div>
    </>}
  </div>;
}

export function InterpretationWorkspace({ interpretation, selectedLens }) {
  if (!interpretation.ready) return <div className="mode-workspace interpretation-workspace"><header><div><h1>Interpretation Mode <span>claim ladder</span></h1><p>V0.7 · movement-oriented research prompts</p></div><span className="mode-badge">V0.7</span></header><div className="mode-empty">{interpretation.reason}</div></div>;
  const lens = interpretation.lenses.find(item => item.id === selectedLens) || interpretation.lenses[0];
  return <div className="mode-workspace interpretation-workspace">
    <header><div><h1>Interpretation Mode <span>claim ladder</span></h1><p>Measurement → cautious neuroscience → philosophical question</p></div><span className="mode-badge">V0.7</span></header>
    <div className="claim-ladder"><section><span>1 · Observed</span><h2>What the analysis measured</h2><p>{interpretation.observation}</p><p>{interpretation.comparison}</p></section><section><span>2 · Bounded</span><h2>What neuroscience can cautiously say</h2><p>{interpretation.cautiousNeuroscience}</p></section><section className="conceptual"><span>3 · Conceptual</span><h2>{lens.title} as a question</h2><p>{lens.prompt}</p><em>{lens.evidence === "available" ? "Data-grounded prompt" : "Conceptual prompt · limited evidence"}</em></section></div>
    <div className="boundary-card"><strong>Cross-scale boundary</strong><p>{interpretation.boundary}</p></div>
    <div className="mode-section-title"><div><h2>Three movement lenses</h2><p>Choose a lens in the inspector; none is assigned automatically.</p></div><span>Human interpretation required</span></div>
    <div className="lens-overview">{interpretation.lenses.map(item => <div className={item.id === lens.id ? "selected" : ""} key={item.id}><span>{item.title}</span><b>{item.evidence}</b><p>{item.prompt}</p></div>)}</div>
  </div>;
}

export function InterpretationPanel({ interpretation, selectedLens, onSelectedLens, onExport }) {
  return <div className="interpretation-panel">
    <div className="results-head"><h2>Movement lenses</h2><span className="quality good">Guardrails on</span></div>
    <p className="panel-copy">The app organizes questions. It does not identify philosophical structures in the brain.</p>
    {interpretation.ready ? <div className="lens-tabs">{interpretation.lenses.map(lens => <button className={selectedLens === lens.id ? "selected" : ""} onClick={() => onSelectedLens(lens.id)} key={lens.id}><span>{lens.title}</span><em>{lens.evidence}</em></button>)}</div> : <div className="compare-empty"><p>{interpretation.reason}</p></div>}
    {interpretation.ready && <><div className="interpretation-rule"><strong>Claim rule</strong><p>Every conceptual statement must remain phrased as a question and retain its fit-quality context.</p></div><button className="primary" onClick={onExport}>Export interpretation note</button></>}
    <hr />
    <h3>Framework basis</h3>
    <div className="framework-sources">{FRAMEWORK_SOURCES.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.title}><b>{source.title}</b><span>{source.detail}</span></a>)}</div>
    <div className="fit-explanation review"><strong>Not a measurement mapping</strong><p>Flow, fold, and field are philosophical concepts. EEG outputs do not validate, localize, or operationalize them.</p></div>
  </div>;
}
