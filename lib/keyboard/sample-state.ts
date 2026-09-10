import { readHistory, saveSnapshot } from './history';
import { sampleConfig } from './sample';
import { changedConfig, sameMap } from './transactions';
import type { KeyboardConfig, Snapshot, TransactionIO } from './types';
import { parseVersion } from './versions';

const STORAGE_KEY = 'cornix.sample.current.v1';

function addresses(config: KeyboardConfig) {
  return config.keys
    .map((key) => `${key.row}:${key.col}`)
    .sort()
    .join('|');
}

function parseCurrentSample(value: unknown): KeyboardConfig {
  const config = parseVersion({
    schemaVersion: 1,
    id: 'sample-workspace',
    name: 'サンプル作業状態',
    createdAt: '2026-01-01T00:00:00Z',
    kind: 'automatic',
    config: value,
  }).config;
  const current = sampleConfig();
  if (
    config.mode !== 'sample' ||
    config.id !== current.id ||
    config.rows !== current.rows ||
    config.cols !== current.cols ||
    config.protocol !== current.protocol ||
    config.layers.length !== current.layers.length ||
    addresses(config) !== addresses(current)
  )
    throw Error('保存されたサンプルは現在のサンプルキーボードと一致しません。');
  return config;
}

export function readSampleState(
  storage: Pick<Storage, 'getItem'> = localStorage,
): KeyboardConfig | null {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error('保存されたサンプルのデータ形式が不正です。');
  }
  return parseCurrentSample(value);
}

export function saveSampleState(
  config: KeyboardConfig,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  const validated = parseCurrentSample(config);
  storage.setItem(STORAGE_KEY, JSON.stringify(validated));
}

type SampleStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function loadSampleState(
  storage: SampleStorage = localStorage,
): KeyboardConfig {
  const saved = readSampleState(storage);
  if (saved) return saved;

  const legacy = readHistory(storage).find(
    (snapshot) => snapshot.before.mode === 'sample',
  );
  const initial = legacy
    ? legacy.status === 'restored'
      ? legacy.before
      : changedConfig(legacy.before, legacy.change)
    : sampleConfig();
  saveSampleState(initial, storage);
  return readSampleState(storage)!;
}

export function createSampleTransactionIO(options: {
  checkpoint(config: KeyboardConfig): Promise<void>;
  onChange(config: KeyboardConfig): void;
  automaticBackup?: boolean;
  storage?: SampleStorage;
}): TransactionIO {
  const automaticBackup = options.automaticBackup ?? true;
  const storage = options.storage ?? localStorage;
  return {
    read: async () => loadSampleState(storage),
    write: async (current, change) => {
      if (automaticBackup) {
        await options.checkpoint(current);
        const latest = loadSampleState(storage);
        if (!sameMap(current, latest))
          throw Error(
            '保存中にキーマップが変わりました。再読み込みして差分を確認してください。',
          );
      }
      const next = changedConfig(current, change);
      saveSampleState(next, storage);
      options.onChange(next);
    },
    save: (snapshot: Snapshot) => saveSnapshot(snapshot, storage),
  };
}
