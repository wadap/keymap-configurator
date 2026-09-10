import { expect, it } from 'vitest';
import { readHistory, saveSnapshot } from '../lib/keyboard/history';
import { sampleConfig } from '../lib/keyboard/sample';
import type { Snapshot } from '../lib/keyboard/types';
import {
  applyChange,
  changedConfig,
  restoreSnapshot,
} from '../lib/keyboard/transactions';

const snapshot = (): Snapshot => ({
  version: 1,
  id: 'test',
  createdAt: '2026-09-10T01:00:00Z',
  before: sampleConfig(),
  change: { layer: 0, row: 1, col: 0, before: 57, after: 41 },
  status: 'prepared',
});
it('retains raw keycodes after a storage round trip and updates the same history entry', () => {
  let value: string | null = null;
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  saveSnapshot(snapshot(), storage);
  saveSnapshot({ ...snapshot(), status: 'applied' }, storage);
  expect(readHistory(storage)).toHaveLength(1);
  expect(readHistory(storage)[0].before.layers[0][20]).toBe(0x5221);
  expect(readHistory(storage)[0].status).toBe('applied');
});
it('rejects corrupted saved key geometry before it can break the editor or Undo', () => {
  const invalid = snapshot();
  (invalid.before as unknown as Record<string, unknown>).keys = null;
  expect(() =>
    readHistory({ getItem: () => JSON.stringify([invalid]) }),
  ).toThrow();
});
it('blocks forged raw actions and malformed JSON without discarding recovery data', () => {
  const invalid = snapshot();
  invalid.change.after = 0x7c00;
  for (const raw of ['{', JSON.stringify([invalid])]) {
    let writes = 0;
    expect(() =>
      saveSnapshot(snapshot(), {
        getItem: () => raw,
        setItem: () => {
          writes++;
        },
      }),
    ).toThrow();
    expect(writes).toBe(0);
  }
});
it('resumes the most recently restored sample after undoing multiple changes', async () => {
  let value: string | null = null,
    current = sampleConfig();
  const storage = {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
  const io = {
    read: async () => current,
    write: async (config: typeof current, change: Snapshot['change']) => {
      current = changedConfig(config, change);
    },
    save: (s: Snapshot) => saveSnapshot(s, storage),
  };
  const first = await applyChange(current, snapshot().change, io);
  const second = await applyChange(
    current,
    { layer: 0, row: 0, col: 1, before: 20, after: 26 },
    io,
  );
  await restoreSnapshot(second.snapshot, io);
  await restoreSnapshot(first.snapshot, io);
  const resumed = readHistory(storage)[0];
  expect(resumed.status).toBe('restored');
  expect(resumed.before.layers).toEqual(sampleConfig().layers);
});
