import { describe, expect, it } from 'vitest';
import type { KeyboardConfig, KeyChange } from '../lib/keyboard/types';
import {
  createVersion,
  diffVersion,
  parseVersion,
  restoreVersion,
  type VersionIO,
} from '../lib/keyboard/versions';
import {
  readVersions,
  saveVersionLocal,
} from '../lib/keyboard/version-storage';

function config(): KeyboardConfig {
  return {
    id: '1234:5678:fixture',
    name: 'Fixture',
    rows: 2,
    cols: 3,
    protocol: 6,
    keys: [
      {
        row: 0,
        col: 0,
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
      {
        row: 0,
        col: 1,
        x: 1,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
      {
        row: 0,
        col: 2,
        x: 2,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
      {
        row: 1,
        col: 0,
        x: 0,
        y: 1,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
      {
        row: 1,
        col: 1,
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
      {
        row: 1,
        col: 2,
        x: 2,
        y: 1,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      },
    ],
    layers: [
      [40, 4, 41, 5, 224, 6],
      [1, 0, 0x5221, 7, 8, 9],
    ],
    layoutWarning: null,
    mode: 'device',
  };
}

function targetConfig(): KeyboardConfig {
  const target = structuredClone(config());
  target.keys[0].x = 99;
  target.layers = [
    [4, 40, 41, 7, 224, 6],
    [1, 10, 0x5221, 7, 8, 9],
  ];
  return target;
}

function memoryPeripheral(initial = config()) {
  let current = structuredClone(initial);
  let failWriteAt: number | null = null;
  let writes = 0;
  const events: string[] = [];
  const backups: KeyboardConfig[] = [];
  const changes: KeyChange[] = [];
  const states: KeyboardConfig[] = [];
  const io: VersionIO = {
    read: async () => {
      events.push('read');
      return structuredClone(current);
    },
    backup: async (value) => {
      events.push('backup');
      backups.push(structuredClone(value));
    },
    write: async (_value, change) => {
      events.push('write');
      writes++;
      if (writes === failWriteAt) throw Error('link lost');
      changes.push({ ...change });
      current.layers[change.layer][change.row * current.cols + change.col] =
        change.after;
      states.push(structuredClone(current));
    },
  };
  return {
    io,
    events,
    backups,
    changes,
    states,
    current: () => structuredClone(current),
    replace: (value: KeyboardConfig) => {
      current = structuredClone(value);
    },
    failWrite: (at: number | null) => {
      failWriteAt = at;
    },
  };
}

describe('saved keymap data', () => {
  it('creates an immutable, normalized multi-layer snapshot that parses as a detached value', () => {
    const source = config();
    const version = createVersion(source, '  My layout  ');
    source.layers[0][0] = 99;
    source.keys[0].x = 99;

    expect(version).toMatchObject({
      schemaVersion: 1,
      name: 'My layout',
      kind: 'manual',
    });
    expect(version.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(new Date(version.createdAt).toISOString()).toBe(version.createdAt);
    expect(version.config.layers[0][0]).toBe(40);
    expect(version.config.keys[0].x).toBe(0);

    const parsed = parseVersion(version);
    parsed.config.layers[1][0] = 99;
    expect(version.config.layers[1][0]).toBe(1);
  });

  it('rejects malformed names, dates, matrix data, duplicate keys, and unsafe geometry', () => {
    const valid = createVersion(config(), 'Valid');
    const cases: unknown[] = [
      { ...valid, name: ' '.repeat(2) },
      { ...valid, createdAt: 'tomorrow' },
      { ...valid, config: { ...config(), layers: [[4]] } },
      {
        ...valid,
        config: { ...config(), keys: [config().keys[0], config().keys[0]] },
      },
      {
        ...valid,
        config: {
          ...config(),
          keys: [{ ...config().keys[0], width: 0 }],
        },
      },
      { ...valid, config: { ...config(), protocol: 7 } },
    ];
    for (const value of cases)
      expect(() => parseVersion(value)).toThrow(/保存|形式|データ/);
  });

  it('accepts a valid ISO timestamp without requiring fractional seconds', () => {
    const version = createVersion(config(), 'Valid');
    expect(
      parseVersion({ ...version, createdAt: '2026-09-10T01:00:00Z' }).createdAt,
    ).toBe('2026-09-10T01:00:00Z');
  });

  it('rejects sparse outer and inner layer arrays in create and parse paths', () => {
    const valid = createVersion(config(), 'Valid');
    const sparseInner = config();
    const sparseInnerLayer: number[] = [];
    sparseInnerLayer.length = sparseInner.rows * sparseInner.cols;
    sparseInner.layers[0] = sparseInnerLayer;
    const sparseOuter = config();
    sparseOuter.layers = [];
    sparseOuter.layers.length = 2;
    sparseOuter.layers[0] = [...config().layers[0]];

    for (const invalid of [sparseInner, sparseOuter]) {
      expect(() => createVersion(invalid, 'Invalid')).toThrow(
        /保存|形式|データ/,
      );
      expect(() => parseVersion({ ...valid, config: invalid })).toThrow(
        /保存|形式|データ/,
      );
    }
  });

  it('accepts only Firestore-compatible persisted version ids', () => {
    const valid = createVersion(config(), 'Valid');
    expect(parseVersion({ ...valid, id: 'codec_snapshot-1' }).id).toBe(
      'codec_snapshot-1',
    );
    for (const id of ['bad/id', '日本語', 'a'.repeat(81)])
      expect(() => parseVersion({ ...valid, id })).toThrow(/保存|形式|データ/);
  });
});

describe('version diff', () => {
  it('returns all changed cells across layers while ignoring visual geometry changes', () => {
    expect(diffVersion(config(), targetConfig())).toEqual([
      { layer: 0, row: 0, col: 0, before: 40, after: 4 },
      { layer: 0, row: 0, col: 1, before: 4, after: 40 },
      { layer: 0, row: 1, col: 0, before: 5, after: 7 },
      { layer: 1, row: 0, col: 1, before: 0, after: 10 },
    ]);
  });

  it('rejects a different device, protocol, dimensions, layer count, or physical address set', () => {
    const variants: KeyboardConfig[] = [
      { ...config(), id: 'other' },
      { ...config(), protocol: 5 },
      {
        ...config(),
        rows: 1,
        layers: [
          [4, 5, 6],
          [7, 8, 9],
        ],
        keys: config().keys.slice(0, 3),
      },
      { ...config(), layers: [config().layers[0]] },
      { ...config(), keys: config().keys.slice(0, 5) },
    ];
    for (const target of variants)
      expect(() => diffVersion(config(), target)).toThrow(/互換|一致|対象/);
  });
});

describe('safe multi-key restore', () => {
  it('backs up first, adds protected keys before removing them, writes serially, and verifies the whole map', async () => {
    const peripheral = memoryPeripheral();
    const result = await restoreVersion(
      config(),
      targetConfig(),
      peripheral.io,
    );

    expect(peripheral.events).toEqual([
      'read',
      'backup',
      'read',
      'write',
      'write',
      'write',
      'write',
      'read',
    ]);
    expect(peripheral.changes).toEqual([
      { layer: 0, row: 0, col: 1, before: 4, after: 40 },
      { layer: 0, row: 0, col: 0, before: 40, after: 4 },
      { layer: 0, row: 1, col: 0, before: 5, after: 7 },
      { layer: 1, row: 0, col: 1, before: 0, after: 10 },
    ]);
    expect(peripheral.backups).toEqual([config()]);
    expect(result.config.layers).toEqual(targetConfig().layers);
    expect(result.config.keys[0].x).toBe(0);
  });

  it('does no backup or write when the preview is stale', async () => {
    const peripheral = memoryPeripheral({
      ...config(),
      layers: [[40, 4, 41, 6, 224, 6], config().layers[1]],
    });
    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow(/変更|再読み込み/);
    expect(peripheral.events).toEqual(['read']);
  });

  it('rejects a fresh device whose physical address set changed before backup', async () => {
    const fresh = config();
    fresh.keys = fresh.keys.slice(0, -1);
    const peripheral = memoryPeripheral(fresh);
    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow(/変更|再読み込み|互換/);
    expect(peripheral.events).toEqual(['read']);
    expect(peripheral.backups).toEqual([]);
    expect(peripheral.changes).toEqual([]);
  });

  it('does no writes if the backup fails', async () => {
    const peripheral = memoryPeripheral();
    peripheral.io.backup = async () => {
      peripheral.events.push('backup');
      throw Error('quota');
    };
    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow('quota');
    expect(peripheral.events).toEqual(['read', 'backup']);
  });

  it('returns a fresh unchanged map without backup or writes when there is no diff', async () => {
    const fresh = config();
    fresh.keys[0].x = 8;
    const peripheral = memoryPeripheral(fresh);
    const result = await restoreVersion(config(), config(), peripheral.io);
    expect(peripheral.events).toEqual(['read']);
    expect(result.config.keys[0].x).toBe(8);
  });

  it('rechecks the device after backup and performs zero writes if it changed while backup was saving', async () => {
    const peripheral = memoryPeripheral();
    peripheral.io.backup = async (value) => {
      peripheral.events.push('backup');
      peripheral.backups.push(structuredClone(value));
      const changedDuringBackup = config();
      changedDuringBackup.layers[1][4] = 9;
      changedDuringBackup.keys = changedDuringBackup.keys.slice(0, -1);
      peripheral.replace(changedDuringBackup);
    };

    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow(/変更|再読み込み|互換/);
    expect(peripheral.events).toEqual(['read', 'backup', 'read']);
    expect(peripheral.backups).toEqual([config()]);
    expect(peripheral.changes).toEqual([]);
  });

  it('writes a true protected-key addition before a protected replacement', async () => {
    const target = config();
    target.layers[0][0] = 41;
    target.layers[0][1] = 40;
    const peripheral = memoryPeripheral();
    peripheral.failWrite(2);

    await expect(
      restoreVersion(config(), target, peripheral.io),
    ).rejects.toThrow(/復元|バックアップ/);
    expect(peripheral.changes).toEqual([
      { layer: 0, row: 0, col: 1, before: 4, after: 40 },
    ]);
    expect(peripheral.current().layers[0].slice(0, 3)).toEqual([40, 40, 41]);
  });

  it('rejects a pure Enter and Escape swap before reading or backing up', async () => {
    const target = config();
    target.layers[0][0] = 41;
    target.layers[0][2] = 40;
    const peripheral = memoryPeripheral();

    await expect(
      restoreVersion(config(), target, peripheral.io),
    ).rejects.toThrow(/保護|安全|復元/);
    expect(peripheral.events).toEqual([]);
    expect(peripheral.backups).toEqual([]);
    expect(peripheral.changes).toEqual([]);
  });

  it('orders a protected-key dependency chain so a failed write retains every recovery key', async () => {
    const current = config();
    current.layers[0] = [41, 40, 224, 4, 5, 6];
    const target = structuredClone(current);
    target.layers[0] = [4, 41, 40, 224, 5, 6];
    const peripheral = memoryPeripheral(current);
    peripheral.failWrite(3);

    await expect(
      restoreVersion(current, target, peripheral.io),
    ).rejects.toThrow(/復元|バックアップ/);
    expect(peripheral.changes).toEqual([
      { layer: 0, row: 1, col: 0, before: 4, after: 224 },
      { layer: 0, row: 0, col: 2, before: 224, after: 40 },
    ]);
    for (const state of peripheral.states) {
      expect(state.layers[0]).toContain(41);
      expect(state.layers[0]).toContain(40);
      expect(state.layers[0]).toContain(224);
    }
  });

  it('backtracks across protected-key dependencies to find a safe complete sequence', async () => {
    const current = config();
    current.layers[0] = [41, 41, 40, 224, 4, 5];
    const target = structuredClone(current);
    target.layers[0] = [40, 224, 40, 41, 4, 5];
    const peripheral = memoryPeripheral(current);

    await restoreVersion(current, target, peripheral.io);
    expect(peripheral.changes).toEqual([
      { layer: 0, row: 0, col: 1, before: 41, after: 224 },
      { layer: 0, row: 1, col: 0, before: 224, after: 41 },
      { layer: 0, row: 0, col: 0, before: 41, after: 40 },
    ]);
    for (const state of peripheral.states) {
      expect(state.layers[0]).toContain(41);
      expect(state.layers[0]).toContain(40);
      expect(state.layers[0]).toContain(224);
    }
  });

  it('bounds planning for an unsafe swap mixed with independent protected changes', async () => {
    const independentChanges = 20;
    const base = [40, 41, ...Array(independentChanges + 1).fill(224)];
    const current: KeyboardConfig = {
      id: '1234:5678:bounded-planner',
      name: 'Bounded planner',
      rows: 1,
      cols: base.length,
      protocol: 6,
      keys: base.map((_, col) => ({
        row: 0,
        col,
        x: col,
        y: 0,
        width: 1,
        height: 1,
        rotation: 0,
        originX: 0,
        originY: 0,
      })),
      layers: [base],
      layoutWarning: null,
      mode: 'device',
    };
    const target = structuredClone(current);
    target.layers[0] = [41, 40, ...Array(independentChanges).fill(226), 224];
    const peripheral = memoryPeripheral(current);
    const started = performance.now();

    await expect(
      restoreVersion(current, target, peripheral.io),
    ).rejects.toThrow(/保護|安全|復元/);
    expect(performance.now() - started).toBeLessThan(500);
    expect(peripheral.events).toEqual([]);
    expect(peripheral.backups).toEqual([]);
    expect(peripheral.changes).toEqual([]);
  });

  it('treats a final readback address-set change as an uncertain recovery failure', async () => {
    const peripheral = memoryPeripheral();
    const read = peripheral.io.read.bind(peripheral.io);
    let reads = 0;
    peripheral.io.read = async () => {
      const value = await read();
      reads++;
      if (reads === 3) value.keys = value.keys.slice(0, -1);
      return value;
    };

    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow(/復元|バックアップ|再接続/);
    expect(peripheral.backups).toEqual([config()]);
    expect(peripheral.changes).toHaveLength(4);
  });

  it('returns geometry from the final verified readback when addresses stay compatible', async () => {
    const peripheral = memoryPeripheral();
    const read = peripheral.io.read.bind(peripheral.io);
    let reads = 0;
    peripheral.io.read = async () => {
      const value = await read();
      reads++;
      if (reads === 2) value.keys[0].x = 25;
      if (reads === 3) value.keys[0].x = 50;
      return value;
    };

    const result = await restoreVersion(
      config(),
      targetConfig(),
      peripheral.io,
    );
    expect(result.config.layers).toEqual(targetConfig().layers);
    expect(result.config.keys[0].x).toBe(50);
  });

  it('rejects incompatible, advanced, hidden-cell, and lost-protected changes before reading or writing', async () => {
    const incompatible = { ...targetConfig(), id: 'other' };
    const advanced = structuredClone(config());
    advanced.layers[1][2] = 4;
    const hiddenCurrent = config();
    hiddenCurrent.keys = hiddenCurrent.keys.filter(
      (key) => !(key.row === 1 && key.col === 2),
    );
    const hiddenTarget = structuredClone(hiddenCurrent);
    hiddenTarget.layers[0][5] = 7;
    const lostProtected = structuredClone(config());
    lostProtected.layers[0][2] = 4;

    for (const [current, target] of [
      [config(), incompatible],
      [config(), advanced],
      [hiddenCurrent, hiddenTarget],
      [config(), lostProtected],
    ] as const) {
      const peripheral = memoryPeripheral(current);
      await expect(
        restoreVersion(current, target, peripheral.io),
      ).rejects.toThrow();
      expect(peripheral.events).toEqual([]);
    }
  });

  it('keeps the backup after a partial failure and can restore it after a fresh read', async () => {
    const peripheral = memoryPeripheral();
    peripheral.failWrite(2);
    await expect(
      restoreVersion(config(), targetConfig(), peripheral.io),
    ).rejects.toThrow(/復元|再接続|バックアップ/);
    expect(peripheral.backups).toEqual([config()]);
    expect(peripheral.current().layers[0]).toEqual([40, 40, 41, 5, 224, 6]);

    peripheral.failWrite(null);
    const recovered = await restoreVersion(
      peripheral.current(),
      peripheral.backups[0],
      peripheral.io,
    );
    expect(recovered.config.layers).toEqual(config().layers);
  });
});

describe('account-local version storage', () => {
  function storage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      values,
    };
  }

  it('keeps newest immutable snapshots separated by owner', () => {
    const memory = storage();
    const first = createVersion(config(), 'First');
    const second = createVersion(targetConfig(), 'Second', 'automatic');
    saveVersionLocal(first, 'alice', memory);
    saveVersionLocal(second, 'alice', memory);

    expect(
      readVersions('alice', memory).map((version) => version.name),
    ).toEqual(['Second', 'First']);
    expect(readVersions('bob', memory)).toEqual([]);
    expect([...memory.values.keys()].sort()).toEqual([
      'cornix.keymap.versions.v1:alice',
    ]);
  });

  it('does not mutate storage for an identical id and rejects changed contents for that id', () => {
    const memory = storage();
    let writes = 0;
    const counted = {
      getItem: memory.getItem,
      setItem: (key: string, value: string) => {
        writes++;
        memory.setItem(key, value);
      },
    };
    const version = createVersion(config(), 'One');
    saveVersionLocal(version, 'alice', counted);
    saveVersionLocal(structuredClone(version), 'alice', counted);
    const reorderedConfig: KeyboardConfig = {
      mode: version.config.mode,
      layoutWarning: version.config.layoutWarning,
      layers: version.config.layers,
      keys: version.config.keys,
      protocol: version.config.protocol,
      cols: version.config.cols,
      rows: version.config.rows,
      name: version.config.name,
      id: version.config.id,
    };
    saveVersionLocal({ ...version, config: reorderedConfig }, 'alice', counted);
    expect(writes).toBe(1);
    expect(() =>
      saveVersionLocal({ ...version, name: 'Changed' }, 'alice', counted),
    ).toThrow(/同じ|変更|上書き/);
    expect(writes).toBe(1);
  });

  it('fails closed on corrupt JSON or invalid records and propagates quota failures', () => {
    const version = createVersion(config(), 'One');
    for (const raw of [
      '{',
      JSON.stringify([{ ...version, schemaVersion: 2 }]),
    ]) {
      let writes = 0;
      const corrupt = {
        getItem: () => raw,
        setItem: () => {
          writes++;
        },
      };
      expect(() => readVersions('alice', corrupt)).toThrow(/保存|形式|データ/);
      expect(() => saveVersionLocal(version, 'alice', corrupt)).toThrow();
      expect(writes).toBe(0);
    }

    expect(() =>
      saveVersionLocal(version, 'alice', {
        getItem: () => null,
        setItem: () => {
          throw Error('quota');
        },
      }),
    ).toThrow('quota');
  });

  it('rejects exact and conflicting duplicate ids when reading persisted data', () => {
    const version = createVersion(config(), 'One');
    const duplicateSets = [
      [version, structuredClone(version)],
      [version, { ...version, name: 'Conflicting contents' }],
    ];
    for (const versions of duplicateSets) {
      expect(() =>
        readVersions('alice', { getItem: () => JSON.stringify(versions) }),
      ).toThrow(/重複|同じID|保存版/);
    }
  });
});
