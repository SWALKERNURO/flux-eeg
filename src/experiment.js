export const EXPERIMENT_SCHEMA = "flux-eeg-experiment/v0.8";

const COLORS = ["#27b6ee", "#8d6bc7", "#9ddd3b", "#d8a653", "#e7655a"];

export function createDefaultProtocol() {
  return {
    schema: EXPERIMENT_SCHEMA,
    name: "Posterior resting-state protocol",
    phases: [
      { id: "settle", name: "Settle", durationSec: 10, instruction: "Sit comfortably and minimize movement.", analyze: false, color: COLORS[3] },
      { id: "eyes-open", name: "Eyes open", durationSec: 60, instruction: "Keep your eyes softly fixed on the center point.", analyze: true, color: COLORS[0] },
      { id: "eyes-closed", name: "Eyes closed", durationSec: 60, instruction: "Close your eyes and remain relaxed but awake.", analyze: true, color: COLORS[1] },
      { id: "recovery", name: "Recovery", durationSec: 10, instruction: "Open your eyes and remain still until the session ends.", analyze: false, color: COLORS[2] },
    ],
  };
}

export function createQuickDemoProtocol() {
  const protocol = createDefaultProtocol();
  return {
    ...protocol,
    name: "Quick demonstration protocol",
    phases: protocol.phases.map((phase, index) => ({ ...phase, durationSec: index === 0 || index === protocol.phases.length - 1 ? 2 : 5 })),
  };
}

export function normalizeProtocol(protocol) {
  const phases = (protocol?.phases || []).map((phase, index) => ({
    id: phase.id || `phase-${index + 1}`,
    name: String(phase.name || `Phase ${index + 1}`).trim(),
    durationSec: Math.max(1, Math.round(Number(phase.durationSec) || 1)),
    instruction: String(phase.instruction || "Follow the researcher’s instruction.").trim(),
    analyze: Boolean(phase.analyze),
    color: phase.color || COLORS[index % COLORS.length],
  }));
  if (!phases.length) throw new Error("Add at least one protocol phase.");
  return { schema: EXPERIMENT_SCHEMA, name: String(protocol?.name || "Untitled protocol").trim(), phases };
}

export function protocolTimeline(protocol) {
  const normalized = normalizeProtocol(protocol);
  let cursor = 0;
  return normalized.phases.map((phase, index) => {
    const start = cursor;
    cursor += phase.durationSec;
    return { ...phase, index, start, end: cursor };
  });
}

export function protocolDuration(protocol) {
  return protocolTimeline(protocol).at(-1)?.end || 0;
}

export function phaseAtElapsed(protocol, elapsedSec) {
  const timeline = protocolTimeline(protocol);
  if (!timeline.length) return null;
  const bounded = Math.max(0, Number(elapsedSec) || 0);
  return timeline.find(phase => bounded < phase.end) || timeline.at(-1);
}

export function buildExperimentMarkers(protocol, elapsedSec = protocolDuration(protocol)) {
  return protocolTimeline(protocol)
    .filter(phase => phase.start <= elapsedSec)
    .map(phase => ({ id: `experiment-${phase.id}`, time: phase.start, label: phase.name, color: phase.color, phaseId: phase.id }));
}

export function buildExperimentConditions(protocol, elapsedSec = protocolDuration(protocol)) {
  return protocolTimeline(protocol)
    .filter(phase => phase.analyze && phase.start < elapsedSec)
    .map(phase => ({ id: `condition-${phase.id}`, name: phase.name, start: phase.start, end: Math.min(phase.end, elapsedSec), color: phase.color }))
    .filter(condition => condition.end - condition.start >= 2);
}

export function createExperimentRun({ protocol, participantId, sessionId, source, rate = 250 }) {
  const normalized = normalizeProtocol(protocol);
  return {
    schema: EXPERIMENT_SCHEMA,
    id: `experiment-${Date.now()}`,
    status: "running",
    source,
    participantId: String(participantId || "P01").trim(),
    sessionId: String(sessionId || "Session 01").trim(),
    protocol: normalized,
    rate,
    elapsedSec: 0,
    currentPhaseId: normalized.phases[0].id,
    markers: buildExperimentMarkers(normalized, 0),
    startedAt: new Date().toISOString(),
    completedAt: null,
    stoppedEarly: false,
    recording: null,
    conditionResults: {},
    addedToStudy: false,
  };
}

export function buildExperimentRecording({ run, channel7, channel8, rate = 250, stoppedEarly = false }) {
  const length = Math.min(channel7.length, channel8.length);
  if (!length) throw new Error("The experiment did not record any samples.");
  const elapsedSec = length / rate;
  return {
    run: {
      ...run,
      status: "complete",
      elapsedSec,
      currentPhaseId: phaseAtElapsed(run.protocol, elapsedSec)?.id || null,
      markers: buildExperimentMarkers(run.protocol, elapsedSec),
      completedAt: new Date().toISOString(),
      stoppedEarly,
      recording: {
        name: `${safeName(run.participantId)}_${safeName(run.sessionId)}_experiment.csv`,
        rate,
        sourceHash: "local-experiment-session",
        channels: { O1: channel7.slice(0, length), O2: channel8.slice(0, length) },
        events: buildExperimentMarkers(run.protocol, elapsedSec),
      },
    },
    conditions: buildExperimentConditions(run.protocol, elapsedSec),
  };
}

export function buildExperimentCsv(run) {
  if (!run?.recording) throw new Error("Complete an experiment before exporting its recording.");
  const { rate, channels } = run.recording;
  const length = Math.min(channels.O1.length, channels.O2.length);
  const markers = new Map((run.markers || []).map(marker => [Math.round(marker.time * rate), marker.label]));
  const rows = [["sample", "time_s", "O1_uV", "O2_uV", "marker"]];
  for (let index = 0; index < length; index += 1) rows.push([index, (index / rate).toFixed(4), channels.O1[index], channels.O2[index], markers.get(index) || ""]);
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

function safeName(value) {
  return String(value || "session").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "session";
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
