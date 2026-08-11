export function buildManifest({ recording, selected, conditions, artifacts, settings, conditionResults, duration }) {
  return {
    schema: "flux-eeg-analysis-manifest/v0.2",
    createdAt: new Date().toISOString(),
    source: { name: recording.name, sampleRate: recording.rate, duration },
    channels: selected,
    conditions,
    artifactExclusions: artifacts,
    settings,
    engine: "Flux spectral-fit 0.2",
    validation: { scipy: "1.14.1", specparam: "2.0.0rc7", status: "passed", fixtures: 3 },
    results: Object.fromEntries(Object.entries(conditionResults).map(([id, result]) => [id, {
      exponent: result.exponent,
      offset: result.offset,
      r2: result.r2,
      error: result.error,
      alphaCF: result.alphaCF,
      alphaPW: result.alphaPW,
      alphaBW: result.alphaBW,
      warnings: result.warnings,
      cleanIntervals: result.cleanIntervals,
    }])),
  };
}

export function buildResultsCsv(conditions, conditionResults) {
  const rows = [
    ["condition", "start_s", "end_s", "exponent", "offset", "r2", "rmse", "alpha_cf_hz", "alpha_pw", "alpha_bw_hz"],
    ...conditions.filter(condition => conditionResults[condition.id]).map(condition => {
      const result = conditionResults[condition.id];
      return [condition.name, condition.start, condition.end, result.exponent, result.offset, result.r2, result.error, result.alphaCF, result.alphaPW, result.alphaBW];
    }),
  ];
  return rows.map(row => row.join(",")).join("\n");
}
