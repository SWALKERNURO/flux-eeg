export const CYTON_SAMPLE_RATE = 250;
export const CYTON_CHANNEL_SCALE_UV = 4.5 / 24 / (2 ** 23 - 1) * 1e6;

export function decodeSignedInt24(msb, middle, lsb) {
  let value = (msb << 16) | (middle << 8) | lsb;
  if (value & 0x800000) value |= 0xff000000;
  return value;
}

export function decodeCytonPacket(packet, scale = CYTON_CHANNEL_SCALE_UV) {
  if (!(packet instanceof Uint8Array) || packet.length !== 33) throw new Error("Cyton packets must contain 33 bytes.");
  if (packet[0] !== 0xa0 || (packet[32] & 0xf0) !== 0xc0) throw new Error("Invalid Cyton packet boundary.");
  const channels = Array.from({ length: 8 }, (_, index) => {
    const offset = 2 + index * 3;
    return decodeSignedInt24(packet[offset], packet[offset + 1], packet[offset + 2]) * scale;
  });
  return { sampleNumber: packet[1], channels, stopByte: packet[32] };
}

export function createCytonPacketParser(onPacket) {
  let buffered = new Uint8Array(0);
  return bytes => {
    const combined = new Uint8Array(buffered.length + bytes.length);
    combined.set(buffered);
    combined.set(bytes, buffered.length);
    let cursor = 0;
    while (cursor + 33 <= combined.length) {
      while (cursor < combined.length && combined[cursor] !== 0xa0) cursor += 1;
      if (cursor + 33 > combined.length) break;
      const candidate = combined.slice(cursor, cursor + 33);
      if ((candidate[32] & 0xf0) === 0xc0) {
        onPacket(decodeCytonPacket(candidate));
        cursor += 33;
      } else cursor += 1;
    }
    buffered = combined.slice(cursor);
  };
}

export async function connectOpenBCI({ onSamples, onStatus, baudRate = 115200 }) {
  if (!navigator.serial) throw new Error("Web Serial is unavailable here. Use current Chrome/Edge or the demo stream.");
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate });
  onStatus?.("connected");
  const writer = port.writable.getWriter();
  await writer.write(new TextEncoder().encode("b"));
  writer.releaseLock();
  const reader = port.readable.getReader();
  let stopped = false;
  const parser = createCytonPacketParser(packet => onSamples(packet.channels, packet.sampleNumber));
  const pump = (async () => {
    try {
      while (!stopped) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) parser(value);
      }
    } finally {
      try { reader.releaseLock(); } catch {}
    }
  })();
  return {
    port,
    stop: async () => {
      stopped = true;
      try { await reader.cancel(); } catch {}
      try {
        const stopWriter = port.writable.getWriter();
        await stopWriter.write(new TextEncoder().encode("s"));
        stopWriter.releaseLock();
      } catch {}
      await pump.catch(() => {});
      try { await port.close(); } catch {}
      onStatus?.("stopped");
    },
  };
}

export function makeDemoLiveBatch(startIndex, count = 25, rate = CYTON_SAMPLE_RATE) {
  const channels = Array.from({ length: 8 }, () => []);
  for (let offset = 0; offset < count; offset += 1) {
    const index = startIndex + offset;
    const time = index / rate;
    const phase = time > 18 ? 1 : 0;
    for (let channel = 0; channel < 8; channel += 1) {
      let aperiodic = 0;
      const targetExponent = phase ? 1.9 : 1.45;
      for (let frequency = 1; frequency <= 45; frequency += 0.25) aperiodic += 3.2 / frequency ** (targetExponent / 2) * Math.sin(2 * Math.PI * frequency * time + channel * 0.17 + frequency * 0.11);
      const alpha = (phase ? 18 : 8) * Math.sin(2 * Math.PI * (10.1 + channel * 0.015) * time);
      const noise = ((Math.sin(index * 17.13 + channel * 9.7) * 10000) % 1) * 2.2;
      channels[channel].push(aperiodic + alpha + noise);
    }
  }
  return { startIndex, count, channels };
}
