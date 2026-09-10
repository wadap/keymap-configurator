import { describe, expect, it } from 'vitest';
import {
  parseDefinition,
  decompressDefinition,
} from '../lib/keyboard/definition';
import { keyLabel, validateChange } from '../lib/keyboard/keycodes';
import { VialClient } from '../lib/keyboard/vial';
import { applyChange, restoreSnapshot } from '../lib/keyboard/transactions';
import type { KeyboardConfig, Snapshot } from '../lib/keyboard/types';

const definition = {
  name: 'Fixture',
  matrix: { rows: 1, cols: 3 },
  layouts: { keymap: [['0,0', '0,1', '0,2']] },
};
const config = (): KeyboardConfig => ({
  id: '1234:5678:0102030405060708',
  name: 'Fixture',
  rows: 1,
  cols: 3,
  protocol: 6,
  keys: parseDefinition(definition).keys,
  layers: [[4, 5, 0x5221]],
  layoutWarning: null,
  mode: 'device',
});
const change = { layer: 0, row: 0, col: 0, before: 4, after: 6 };

describe('definition and allowed key operations', () => {
  it('decodes an actual XZ-compressed Vial JSON definition using the shipped WASM', async () => {
    const bytes = Buffer.from(
      '/Td6WFoAAATm1rRGAgAhARYAAAB0L+Wj4ABZAE9dAD2IicZUNsMXT+KeWyHTythsR4C/xks+eGXfHw9wL99qFzxKm9yMk5LCNh3YCP29jjzP+u1QEUPtJZZHc67ZOoTbIem+OIuchBz7LV0mg5EAAJ9ryz0hT3oiAAFrWq2/MS0ftvN9AQAAAAAEWVo=',
      'base64',
    );
    expect(await decompressDefinition(bytes)).toEqual({
      name: 'XZ Fixture',
      matrix: { rows: 1, cols: 1 },
      layouts: { keymap: [['0,0']] },
    });
  });
  it('preserves matrix coordinates across split offsets and rotation', () => {
    const result = parseDefinition({
      ...definition,
      layouts: {
        keymap: [
          ['0,0', { x: 2 }, '0,1'],
          [{ r: 15, rx: 2, ry: 3 }, '0,2'],
        ],
      },
    });
    expect(
      result.keys.map((k) => [k.row, k.col, k.x, k.y, k.rotation]),
    ).toEqual([
      [0, 0, 0, 0, 0],
      [0, 1, 3, 0, 0],
      [0, 2, 2, 3, 15],
    ]);
  });
  it('rejects out-of-bounds physical keys instead of addressing another matrix cell', () => {
    expect(() =>
      parseDefinition({ ...definition, layouts: { keymap: [['1,0']] } }),
    ).toThrow();
  });
  it('keeps unknown codes visible and prevents overwriting a layer action', () => {
    expect(keyLabel(0xffff)).toBe('0xFFFF');
    expect(() =>
      validateChange(config(), { ...change, col: 2, before: 0x5221 }),
    ).toThrow();
    expect(config().layers[0][2]).toBe(0x5221);
  });
  it('rejects raw dangerous values, fractional positions, and invalid layers', () => {
    for (const c of [
      { ...change, after: 0x7c00 },
      { ...change, col: 0.5 },
      { ...change, layer: 1 },
    ]) {
      expect(() => validateChange(config(), c)).toThrow();
    }
  });
});

describe('Vial wire protocol', () => {
  it('reads across packet and 256-byte address boundaries without losing the final bytes', async () => {
    const sent: number[][] = [],
      memory = new Uint8Array(300);
    memory.set([0x12, 0x34]);
    memory.set([0xab, 0xcd], 298);
    const client = new VialClient({
      request: async (bytes) => {
        const response = new Uint8Array(32);
        if (bytes[0] === 0xfe)
          response.set([6, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
        else {
          sent.push(bytes);
          response.set(bytes);
          const offset = (bytes[1] << 8) | bytes[2];
          response.set(memory.slice(offset, offset + bytes[3]), 4);
        }
        return response;
      },
    });
    const result = await client.read({
      ...config(),
      rows: 5,
      cols: 10,
      layers: [[], [], []],
    });
    expect(result.layers[0][0]).toBe(0x1234);
    expect(result.layers[2][49]).toBe(0xabcd);
    expect(sent[0]).toEqual([0x12, 0, 0, 28]);
    expect(sent.at(-1)).toEqual([0x12, 1, 24, 20]);
    expect(sent).toHaveLength(11);
  });
  it('loads UID, little-endian definition blocks, and big-endian layer buffer', async () => {
    const sent: number[][] = [];
    const client = new VialClient(
      {
        request: async (bytes) => {
          sent.push([...bytes]);
          const response = new Uint8Array(32);
          if (bytes[0] === 1) response.set([1, 0, 9]);
          else if (bytes[0] === 0xfe && bytes[1] === 0)
            response.set([6, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8]);
          else if (bytes[0] === 0xfe && bytes[1] === 1)
            response.set([33, 0, 0, 0]);
          else if (bytes[0] === 0xfe && bytes[1] === 2)
            response.fill(bytes[2] === 0 ? 9 : 8);
          else if (bytes[0] === 0x11) response.set([0x11, 2]);
          else if (bytes[0] === 0x12)
            response.set([
              0x12, 0, 0, 12, 0, 4, 0, 5, 0x52, 0x21, 0, 6, 0, 7, 0xff, 0xff,
            ]);
          else throw Error('Unexpected command');
          return response;
        },
      },
      async (bytes) => {
        expect(bytes.length).toBe(33);
        expect(bytes[32]).toBe(8);
        return definition;
      },
    );
    const result = await client.load({
      vendorId: 0x1234,
      productId: 0x5678,
      productName: 'Fixture',
    });
    expect(result.layers).toEqual([
      [4, 5, 0x5221],
      [6, 7, 0xffff],
    ]);
    expect(result.id).toBe('1234:5678:0102030405060708');
    expect(sent).toContainEqual([0xfe, 2, 1, 0, 0, 0]);
    expect(sent).toContainEqual([0x12, 0, 0, 12]);
  });
  it('encodes write address and 16-bit value without swapping byte order', async () => {
    const sent: number[][] = [];
    const client = new VialClient({
      request: async (b) => {
        sent.push([...b]);
        const r = new Uint8Array(32);
        r.set(b);
        return r;
      },
    });
    await client.writeKey(config(), { ...change, after: 0xe3 });
    expect(sent).toEqual([[5, 0, 0, 0, 0, 0xe3]]);
  });
  it('rejects unrecognized firmware before reading a definition', async () => {
    const client = new VialClient({
      request: async () => Uint8Array.from([1, 0, 12, ...Array(29).fill(0)]),
    });
    await expect(
      client.load({ vendorId: 1, productId: 1, productName: '' }),
    ).rejects.toThrow();
  });
});

describe('safe apply and persistent Undo', () => {
  function setup() {
    let current = config();
    const saved: Snapshot[] = [];
    const events: string[] = [];
    const io = {
      read: async () => structuredClone(current),
      write: async (_config: KeyboardConfig, c: typeof change) => {
        events.push('write');
        current.layers[c.layer][c.row * current.cols + c.col] = c.after;
      },
      save: (s: Snapshot) => {
        events.push('save');
        saved.push(structuredClone(s));
      },
    };
    return {
      io,
      saved,
      events,
      set: (c: KeyboardConfig) => {
        current = c;
      },
    };
  }
  it('persists all raw layers before writing, verifies result, and restores with Undo', async () => {
    const f = setup();
    const result = await applyChange(config(), change, f.io);
    expect(f.events.slice(0, 2)).toEqual(['save', 'write']);
    expect(f.saved[0].before.layers).toEqual([[4, 5, 0x5221]]);
    expect(result.config.layers).toEqual([[6, 5, 0x5221]]);
    const undone = await restoreSnapshot(result.snapshot, f.io);
    expect(undone.config.layers).toEqual([[4, 5, 0x5221]]);
    expect(undone.snapshot.status).toBe('restored');
  });
  it('does not write if local snapshot persistence fails', async () => {
    const f = setup();
    f.io.save = () => {
      throw Error('quota');
    };
    await expect(applyChange(config(), change, f.io)).rejects.toThrow('quota');
    expect(f.events).toEqual([]);
  });
  it('blocks stale maps and mismatched device identities', async () => {
    for (const fresh of [
      { ...config(), id: 'other-device' },
      { ...config(), protocol: 5 },
      { ...config(), keys: config().keys.slice(0, -1) },
      { ...config(), layers: [[4, 7, 0x5221]] },
    ]) {
      const f = setup();
      f.set(fresh);
      await expect(applyChange(config(), change, f.io)).rejects.toThrow();
      expect(f.events).toEqual([]);
    }
  });
  it('retains recovery data on readback failure and can recover after reconnect', async () => {
    const f = setup();
    const read = f.io.read;
    let count = 0;
    f.io.read = () => {
      if (++count === 2) throw Error('disconnected');
      return read();
    };
    await expect(applyChange(config(), change, f.io)).rejects.toThrow();
    expect(f.saved.at(-1)?.status).toBe('uncertain');
    f.io.read = read;
    const restored = await restoreSnapshot(f.saved.at(-1)!, f.io);
    expect(restored.config.layers).toEqual([[4, 5, 0x5221]]);
  });
  it('does not overwrite an unrelated modification during Undo', async () => {
    const f = setup();
    const result = await applyChange(config(), change, f.io);
    f.set({ ...config(), layers: [[6, 9, 0x5221]] });
    const writes = f.events.filter((e) => e === 'write').length;
    await expect(restoreSnapshot(result.snapshot, f.io)).rejects.toThrow();
    expect(f.events.filter((e) => e === 'write').length).toBe(writes);
  });
});
