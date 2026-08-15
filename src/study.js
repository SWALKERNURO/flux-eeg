function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

export function createEmptyStudy(name = "Untitled study") {
  return { schema: "flux-eeg-study/v0.5", name, createdAt: new Date().toISOString(), records: [] };
}

export function addStudyRecord(study, record) {
  if (!record.participantId?.trim()) throw new Error("Participant ID is required.");
  if (!record.conditionResults || !Object.keys(record.conditionResults).length) throw new Error("Analyze at least one condition before adding a study record.");
  const normalized = {
    id: record.id || `record-${Date.now()}-${study.records.length}`,
    participantId: record.participantId.trim(),
    sessionId: record.sessionId?.trim() || `Session ${study.records.filter(item => item.participantId === record.participantId.trim()).length + 1}`,
    sourceName: record.sourceName || "recording",
    sourceHash: record.sourceHash || "unavailable",
    addedAt: new Date().toISOString(),
    conditionResults: Object.fromEntries(Object.entries(record.conditionResults).map(([name, result]) => [name, {
      exponent: Number(result.exponent), offset: Number(result.offset), r2: Number(result.r2), error: Number(result.error),
      alphaCF: Number(result.alphaCF || 0), alphaPW: Number(result.alphaPW || 0), alphaBW: Number(result.alphaBW || 0),
      confidence: result.confidence || null,
    }])),
  };
  return { ...study, records: [...study.records, normalized] };
}

export function studyConditionNames(study) {
  return [...new Set(study.records.flatMap(record => Object.keys(record.conditionResults || {})))];
}

function participantConditionMeans(study, conditionName, metric) {
  const grouped = new Map();
  study.records.forEach(record => {
    const value = record.conditionResults?.[conditionName]?.[metric];
    if (!Number.isFinite(value)) return;
    if (!grouped.has(record.participantId)) grouped.set(record.participantId, []);
    grouped.get(record.participantId).push(value);
  });
  return new Map([...grouped.entries()].map(([participantId, values]) => [participantId, mean(values)]));
}

export function summarizeStudy(study, conditionA, conditionB, metric = "exponent") {
  const names = studyConditionNames(study);
  const first = conditionA || names[0] || "Condition A";
  const second = conditionB || names[1] || "Condition B";
  const firstValues = participantConditionMeans(study, first, metric);
  const secondValues = participantConditionMeans(study, second, metric);
  const paired = [...firstValues.keys()].filter(participantId => secondValues.has(participantId)).map(participantId => ({
    participantId, first: firstValues.get(participantId), second: secondValues.get(participantId), difference: secondValues.get(participantId) - firstValues.get(participantId),
  }));
  const differences = paired.map(item => item.difference);
  const meanDifference = mean(differences);
  const differenceSd = sampleStandardDeviation(differences);
  const dz = differenceSd > 0 ? meanDifference / differenceSd : 0;
  const standardError = paired.length > 1 ? differenceSd / Math.sqrt(paired.length) : 0;
  const magnitude = Math.abs(dz) >= 0.8 ? "large" : Math.abs(dz) >= 0.5 ? "moderate" : Math.abs(dz) >= 0.2 ? "small" : "minimal";
  return {
    metric, conditionA: first, conditionB: second, participants: new Set(study.records.map(record => record.participantId)).size,
    records: study.records.length, pairedCount: paired.length, paired,
    meanA: mean([...firstValues.values()]), meanB: mean([...secondValues.values()]), meanDifference, differenceSd, dz, magnitude,
    ci95: [meanDifference - 1.96 * standardError, meanDifference + 1.96 * standardError],
  };
}

export function createDemoStudy() {
  const open = [1.38, 1.51, 1.44, 1.62, 1.55, 1.47, 1.58, 1.41];
  const closed = [1.43, 2.06, 1.39, 2.27, 1.67, 1.89, 1.58, 1.94];
  let study = createEmptyStudy("Posterior rest pilot");
  open.forEach((value, index) => {
    study = addStudyRecord(study, {
      participantId: `P${String(index + 1).padStart(2, "0")}`,
      sessionId: "Rest 01",
      sourceName: `P${String(index + 1).padStart(2, "0")}_rest.csv`,
      conditionResults: {
        "Eyes open": { exponent: value, offset: 1.1 + index * 0.02, r2: 0.95 + (index % 3) * 0.01, error: 0.06, alphaCF: 10.1, alphaPW: 0.62 + index * 0.02, alphaBW: 2.2 },
        "Eyes closed": { exponent: closed[index], offset: 1.25 + index * 0.02, r2: 0.96 + (index % 2) * 0.01, error: 0.05, alphaCF: 10.2, alphaPW: 1.1 + index * 0.04, alphaBW: 2.4 },
      },
    });
  });
  return study;
}

export function buildStudyCsv(study) {
  const rows = [["participant_id", "session_id", "source", "condition", "exponent", "offset", "r2", "rmse", "alpha_cf_hz", "alpha_pw", "alpha_bw_hz"]];
  study.records.forEach(record => Object.entries(record.conditionResults).forEach(([condition, result]) => rows.push([
    record.participantId, record.sessionId, record.sourceName, condition, result.exponent, result.offset, result.r2, result.error, result.alphaCF, result.alphaPW, result.alphaBW,
  ])));
  return rows.map(row => row.map(csvCell).join(",")).join("\n");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
