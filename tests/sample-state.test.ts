import { describe, expect, it } from 'vitest';
import { readHistory } from '../lib/keyboard/history';
import { sampleConfig } from '../lib/keyboard/sample';
import {
  createSampleTransactionIO,
  loadSampleState,
  readSampleState,
  saveSampleState,
} from '../lib/keyboard/sample-state';
import { applyChange } from '../lib/keyboard/transactions';
import type { KeyboardConfig } from '../lib/keyboard/types';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    values,
  };
}

describe('persistent sample workspace', () => {
  it('returns null when no current sample has been saved', () => {
    expect(readSampleState({ getItem: () => null })).toBeNull();
  });

  it('preserves a restored multi-layer target across a fresh read', () => {
    const storage = memoryStorage();
    const restored = sampleConfig();
    restored.layers[0][1] = 6;
    restored.layers[1][8] = 46;
    restored.layers[2][20] = 82;
    restored.layers[3][47] = 44;

    saveSampleState(restored, storage);
    restored.layers[0][1] = 99;

    const reloaded = readSampleState(storage);
    expect([...storage.values.keys()]).toEqual(['cornix.sample.current.v1']);
    expect(reloaded?.layers[0][1]).toBe(6);
    expect(reloaded?.layers[1][8]).toBe(46);
    expect(reloaded?.layers[2][20]).toBe(82);
    expect(reloaded?.layers[3][47]).toBe(44);
    expect(reloaded).not.toBe(restored);
  });

  it('rejects malformed, device-mode, and noncurrent sample data on read', () => {
    const current = sampleConfig();
    const variants: unknown[] = [
      '{',
      { ...current, mode: 'device' },
      { ...current, id: 'sample:another-keyboard' },
      { ...current, protocol: 5 },
      { ...current, keys: current.keys.slice(0, -1) },
      { ...current, layers: current.layers.slice(0, -1) },
      { ...current, rows: 7 },
    ];

    for (const value of variants) {
      const raw = typeof value === 'string' ? value : JSON.stringify(value);
      expect(() => readSampleState({ getItem: () => raw })).toThrow(
        /サンプル|保存|形式|一致/,
      );
    }
  });

  it('validates before saving and never overwrites with an invalid sample', () => {
    const storage = memoryStorage();
    storage.values.set('cornix.sample.current.v1', 'existing recovery data');
    let writes = 0;
    const guarded = {
      setItem: (key: string, value: string) => {
        writes++;
        storage.setItem(key, value);
      },
    };
    const invalid: KeyboardConfig = { ...sampleConfig(), mode: 'device' };

    expect(() => saveSampleState(invalid, guarded)).toThrow(/サンプル|一致/);
    expect(writes).toBe(0);
    expect(storage.values.get('cornix.sample.current.v1')).toBe(
      'existing recovery data',
    );
  });

  it('propagates quota failures to the caller', () => {
    expect(() =>
      saveSampleState(sampleConfig(), {
        setItem: () => {
          throw Error('quota exceeded');
        },
      }),
    ).toThrow('quota exceeded');
  });

  it('keeps the original sample after the first edit backup fails and the workspace reloads', async () => {
    const storage = memoryStorage();
    const original = sampleConfig();
    const change = {
      layer: 0,
      row: 0,
      col: 0,
      before: original.layers[0][0],
      after: 4,
    };
    const io = createSampleTransactionIO({
      storage,
      checkpoint: async () => {
        throw Error('backup failed');
      },
      onChange: () => {},
    });

    await expect(applyChange(original, change, io)).rejects.toThrow(
      /backup failed/,
    );
    expect(readHistory(storage)[0].status).toBe('uncertain');

    const reloaded = loadSampleState(storage);
    expect(reloaded.layers[0][0]).toBe(change.before);
    expect(readSampleState(storage)?.layers[0][0]).toBe(change.before);
  });

  it('persists the deliberate legacy-history migration as current sample state', () => {
    const storage = memoryStorage();
    const before = sampleConfig();
    const change = {
      layer: 0,
      row: 0,
      col: 0,
      before: before.layers[0][0],
      after: 4,
    };
    storage.setItem(
      'cornix.keymap.snapshots.v1',
      JSON.stringify([
        {
          version: 1,
          id: 'legacy-edit',
          createdAt: '2026-09-10T00:00:00Z',
          before,
          change,
          status: 'applied',
        },
      ]),
    );

    expect(loadSampleState(storage).layers[0][0]).toBe(change.after);
    expect(readSampleState(storage)?.layers[0][0]).toBe(change.after);
  });
});
