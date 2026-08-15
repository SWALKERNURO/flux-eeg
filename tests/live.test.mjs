import test from "node:test";
import assert from "node:assert/strict";
import { createCytonPacketParser, decodeCytonPacket, decodeSignedInt24, makeDemoLiveBatch } from "../src/live.js";

test("signed 24-bit decoder preserves positive and negative counts", () => {
  assert.equal(decodeSignedInt24(0x00, 0x00, 0x02), 2);
  assert.equal(decodeSignedInt24(0xff, 0xff, 0xfe), -2);
});
test("Cyton parser recovers packets split across serial chunks", () => {
  const packet = new Uint8Array(33); packet[0] = 0xa0; packet[1] = 7; packet[4] = 10; packet[32] = 0xc0;
  const decoded = decodeCytonPacket(packet, 1);
  assert.equal(decoded.sampleNumber, 7);
  assert.equal(decoded.channels[0], 10);
  const received = [];
  const parse = createCytonPacketParser(value => received.push(value));
  parse(packet.slice(0, 12)); parse(packet.slice(12));
  assert.equal(received.length, 1);
  assert.equal(received[0].sampleNumber, 7);
});

test("live demo emits eight aligned channels", () => {
  const batch = makeDemoLiveBatch(0, 25);
  assert.equal(batch.channels.length, 8);
  assert.equal(batch.channels.every(channel => channel.length === 25), true);
});
