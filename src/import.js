export function parseOpenBCI(text, fileName) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  let rate = 250;
  for (const line of lines.slice(0, 30)) {
    const match = line.match(/sample\s*rate[^0-9]*(\d+(?:\.\d+)?)/i);
    if (match) rate = Number(match[1]);
  }
  const dataLines = lines.filter(line => !line.trim().startsWith("%") && !line.trim().startsWith("#"));
  const first = dataLines[0]?.split(/,|\t/).map(cell => cell.trim()) || [];
  const hasHeader = first.some(value => value !== "" && Number.isNaN(Number(value)));
  const headers = hasHeader ? first : Array.from({ length: first.length }, (_, index) => `Channel ${index + 1}`);
  const rows = (hasHeader ? dataLines.slice(1) : dataLines).map(line => line.split(/,|\t/).map(cell => cell.trim())).filter(row => row.length > 2);
  if (!rows.length) throw new Error("No EEG samples were found.");
  const width = Math.min(headers.length, ...rows.map(row => row.length));
  const markerIndex = headers.slice(0, width).findIndex(name => /marker|event|trigger/i.test(name));
  const ignore = /sample|index|time|timestamp|accel|aux|marker|event|trigger/i;
  const usable = headers.slice(0, width).map((name, index) => ({ name, index })).filter(column => !ignore.test(column.name)).slice(0, 16);
  const channels = {};
  usable.forEach((column, index) => {
    const preferred = /\bO1\b/i.test(column.name) ? "O1" : /\bO2\b/i.test(column.name) ? "O2" : column.name || `Channel ${index + 1}`;
    channels[preferred] = rows.map(row => Number(row[column.index])).map(value => Number.isFinite(value) ? value : 0);
  });
  if (!Object.keys(channels).length) throw new Error("Could not identify EEG columns.");
  const events = [];
  let previousMarker = "";
  if (markerIndex >= 0) {
    rows.forEach((row, index) => {
      const marker = String(row[markerIndex] ?? "").trim();
      if (marker && marker !== "0" && marker !== previousMarker) events.push({ id: `imported-event-${index}`, time: index / rate, label: marker, color: "#d8a653" });
      previousMarker = marker === "0" ? "" : marker;
    });
  }
  return { name: fileName, rate, channels, events };
}
