export const FRAMEWORK_SOURCES = Object.freeze([
  { title: "Being and Motion", detail: "Flow, fold, and field as a movement-centered ontology", url: "https://academic.oup.com/book/43685" },
  { title: "The Philosophy of Movement", detail: "Movement as analytically primary across scales", url: "https://philosophy-of-movement.com/" },
  { title: "Thomas Nail at the University of Denver", detail: "Author profile and research scope", url: "https://liberalarts.du.edu/about/people/thomas-andrew-nail" },
]);

function strongestConditionDifference(conditions, results) {
  const ready = conditions.filter(condition => results[condition.id]);
  if (ready.length < 2) return null;
  const first = ready[0];
  const second = ready[1];
  const a = results[first.id];
  const b = results[second.id];
  return { first, second, exponentDelta: b.exponent - a.exponent, alphaDelta: b.alphaPW - a.alphaPW, reliable: a.r2 >= 0.9 && b.r2 >= 0.9 };
}
export function buildInterpretation({ result, conditions = [], conditionResults = {}, dynamicsSummary = null }) {
  if (!result) return { ready: false, reason: "Analyze a selection or condition before opening Interpretation." };
  const comparison = strongestConditionDifference(conditions, conditionResults);
  const observation = result.r2 >= 0.9
    ? `The selected spectrum has an aperiodic exponent of ${result.exponent.toFixed(2)} with R² ${result.r2.toFixed(2)}${result.alphaCF ? ` and an alpha peak at ${result.alphaCF.toFixed(1)} Hz` : ""}.`
    : `The current fit is weak (R² ${result.r2.toFixed(2)}), so exponent and peak values remain visible for inspection but should not anchor an interpretation.`;
  const comparisonText = comparison
    ? comparison.reliable
      ? `${comparison.second.name} differs from ${comparison.first.name} by ${comparison.exponentDelta >= 0 ? "+" : ""}${comparison.exponentDelta.toFixed(2)} in exponent and ${comparison.alphaDelta >= 0 ? "+" : ""}${comparison.alphaDelta.toFixed(2)} in alpha peak power.`
      : `The condition difference is withheld from interpretation because at least one fit is below R² 0.90.`
    : "No paired condition comparison is available yet.";
  const reliableDynamics = dynamicsSummary?.reliableCount || 0;
  const lenses = [
    {
      id: "flow", title: "Flow", evidence: reliableDynamics ? "available" : "limited",
      prompt: reliableDynamics
        ? `The reliable exponent trajectory ranges from ${dynamicsSummary.minimum.toFixed(2)} to ${dynamicsSummary.maximum.toFixed(2)}. Could its continuous variation be described as a changing flow rather than a sequence of fixed states?`
        : "What changes when the recording is treated as a continuous trajectory rather than a sequence of fixed states? Reliable moving windows are needed before grounding this prompt in the data.",
    },
    {
      id: "fold", title: "Fold", evidence: result.alphaCF && result.r2 >= 0.9 ? "available" : "limited",
      prompt: result.alphaCF && result.r2 >= 0.9
        ? `A repeatable ${result.alphaCF.toFixed(1)} Hz alpha feature is a periodic pattern in the spectrum. Could repeated organization be discussed as a provisional fold or metastable pattern—without claiming that the alpha rhythm is literally a philosophical fold?`
        : "A fold prompt needs a stable, repeatable spectral pattern. The current result does not yet support one.",
    },
    {
      id: "field", title: "Field", evidence: comparison?.reliable ? "available" : "limited",
      prompt: comparison?.reliable
        ? `${comparisonText} Could these coordinated changes be framed as relations within a field of conditions, while keeping the statistical and conceptual levels distinct?`
        : "A field prompt becomes useful when multiple reliable conditions can be compared as relations rather than isolated values.",
    },
  ];
  return {
    ready: true,
    observation,
    comparison: comparisonText,
    cautiousNeuroscience: result.r2 >= 0.9
      ? "A spectral slope and oscillatory peak describe the frequency structure of this recording. They do not by themselves identify excitation/inhibition balance, consciousness, subjectivity, or a specific cognitive mechanism."
      : "The fit-quality warning takes priority. No neuroscientific or philosophical conclusion should be built from this estimate.",
    lenses,
    boundary: "Flow, fold, and field are interpretive prompts across conceptual scales—not variables measured by EEG and not labels assigned by the algorithm.",
  };
}

export function buildInterpretationNote({ interpretation, recordingName, selectionLabel }) {
  if (!interpretation?.ready) throw new Error(interpretation?.reason || "No interpretation is ready.");
  return `Flux EEG V0.7 interpretation note\n\nRecording: ${recordingName}\nSelection: ${selectionLabel}\n\nOBSERVED\n${interpretation.observation}\n${interpretation.comparison}\n\nCAUTIOUS NEUROSCIENCE\n${interpretation.cautiousNeuroscience}\n\nNAIL-INSPIRED QUESTIONS\n${interpretation.lenses.map(lens => `${lens.title} [${lens.evidence}]: ${lens.prompt}`).join("\n\n")}\n\nBOUNDARY\n${interpretation.boundary}\n\nThis note is a structured research prompt, not diagnosis, causal inference, or evidence that a philosophical concept has been measured.`;
}
