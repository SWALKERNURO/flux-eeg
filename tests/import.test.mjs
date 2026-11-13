import test from "node:test";
import assert from "node:assert/strict";
import { parseOpenBCI } from "../src/import.js";

test("OpenBCI import detects sample rate, posterior channels, and marker changes", () => {
  const text = [
    "%Sample Rate = 125 Hz",
    "Sample Index,O1,O2,Marker",
    "0,1,2,0",
    "1,2,3,Eyes closed",
    "2,3,4,Eyes closed",
    "3,4,5,0",
    "4,5,6,Eyes open",
  ].join("\n");
  const recording = parseOpenBCI(text, "markers.csv");
  assert.equal(recording.rate, 125);
  assert.deepEqual(recording.channels.O1, [1, 2, 3, 4, 5]);
  assert.deepEqual(recording.events.map(event => event.label), ["Eyes closed", "Eyes open"]);
  assert.equal(recording.events[1].time, 4 / 125);
});
