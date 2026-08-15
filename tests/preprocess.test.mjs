import test from "node:test";
import assert from "node:assert/strict";
import { assessChannelQuality, DEFAULT_PREPROCESSING, detectArtifactIntervals, detrendSignal, preprocessSignal } from "../src/preprocess.js";

test("linear detrending removes a deterministic ramp", () => {
  const values = Array.from({ length: 1000 }, (_, index) => 12 + index * 0.04 + Math.sin(index / 10));
  const cleaned = detrendSignal(values);
  assert.ok(Math.abs(cleaned.reduce((sum, value) => sum + value, 0) / cleaned.length) < 1e-9);
  assert.ok(Math.abs(cleaned.at(-1) - cleaned[0]) < 2);
});

test("notch preprocessing attenuates a 60 Hz component", () => {
  const rate = 250;
  const values = Array.from({ length: rate * 8 }, (_, index) => 8 * Math.sin(2 * Math.PI * 10 * index / rate) + 20 * Math.sin(2 * Math.PI * 60 * index / rate));
  const cleaned = preprocessSignal(values, rate, { ...DEFAULT_PREPROCESSING, highpassHz: 0, lowpassHz: 0 });
  const projection = (signal, frequency) => Math.abs(signal.reduce((sum, value, index) => sum + value * Math.sin(2 * Math.PI * frequency * index / rate), 0));
  assert.ok(projection(cleaned, 60) < projection(values, 60) * 0.2);
  assert.ok(projection(cleaned, 10) > projection(values, 10) * 0.7);
});

test("quality screen identifies flat channels and artifact suggestions", () => {
  const rate = 250;
  const good = Array.from({ length: rate * 4 }, (_, index) => 20 * Math.sin(2 * Math.PI * 10 * index / rate));
  good[500] = 400;
  const quality = assessChannelQuality({ O1: good, Flat: Array(rate * 4).fill(2) }, rate);
  assert.equal(quality.find(channel => channel.name === "Flat").status, "bad");
  assert.ok(detectArtifactIntervals({ O1: good }, ["O1"], rate).length >= 1);
});
