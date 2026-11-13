const PROJECT_SCHEMA = "flux-eeg-project/v0.8";
const LEGACY_SCHEMAS = ["flux-eeg-project/v0.3", "flux-eeg-project/v0.4", "flux-eeg-project/v0.7"];

export function buildProjectSnapshot(state) {
  return {
    schema: PROJECT_SCHEMA,
    savedAt: new Date().toISOString(),
    recording: state.recording,
    selected: state.selected,
    range: state.range,
    conditions: state.conditions,
    artifacts: state.artifacts,
    events: state.events,
    annotations: state.annotations,
    dynamicsSettings: state.dynamicsSettings,
    preprocessing: state.preprocessing,
    study: state.study,
    experimentProtocol: state.experimentProtocol,
    experimentRun: state.experimentRun?.status === "running" ? null : state.experimentRun,
  };
}

export function parseProjectSnapshot(value) {
  const project = typeof value === "string" ? JSON.parse(value) : value;
  if (![PROJECT_SCHEMA, ...LEGACY_SCHEMAS].includes(project?.schema)) throw new Error("This is not a supported Flux EEG project file.");
  if (!project.recording?.rate || !project.recording?.channels || !Object.keys(project.recording.channels).length) throw new Error("The project file does not contain a valid recording.");
  if (!Array.isArray(project.conditions) || !Array.isArray(project.artifacts) || !Array.isArray(project.events)) throw new Error("The project file is missing interval metadata.");
  return { ...project, schema: PROJECT_SCHEMA };
}

export { PROJECT_SCHEMA };
