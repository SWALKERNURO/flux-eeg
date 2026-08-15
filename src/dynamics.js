export function detectTransitions(points, threshold = 0.08) {
  const transitions = [];
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const delta = current.v - previous.v;
    const quality = Math.min(previous.r2 ?? 1, current.r2 ?? 1);
    if (quality >= 0.9 && Math.abs(delta) >= threshold) {
      transitions.push({
        id: `transition-${index}`,
        time: current.t,
        delta,
        direction: delta > 0 ? "steepening" : "flattening",
        quality,
      });
    }
  }
  return transitions;
}

export function summarizeDynamics(points, threshold = 0.08) {
  const transitions = detectTransitions(points, threshold);
  const reliable = points.filter(point => (point.r2 ?? 1) >= 0.9);
  if (!reliable.length) return { transitions, mean: 0, minimum: 0, maximum: 0, stableShare: 0, reliableCount: 0 };
  const values = reliable.map(point => point.v);
  let stableSteps = 0, comparableSteps = 0;
  for (let index = 1; index < points.length; index += 1) {
    if ((points[index - 1].r2 ?? 1) < 0.9 || (points[index].r2 ?? 1) < 0.9) continue;
    comparableSteps += 1;
    if (Math.abs(points[index].v - points[index - 1].v) < threshold) stableSteps += 1;
  }
  return {
    transitions,
    mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    minimum: Math.min(...values),
    maximum: Math.max(...values),
    stableShare: comparableSteps ? stableSteps / comparableSteps : 1,
    reliableCount: reliable.length,
  };
}
