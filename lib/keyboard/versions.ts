import { isEditable, keyLabel } from './keycodes';
import { sameMap, samePhysicalAddresses } from './transactions';
import type { KeyboardConfig, KeyChange } from './types';

export type KeymapVersion = {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  kind: 'manual' | 'automatic';
  config: KeyboardConfig;
};

export type VersionIO = {
  read(): Promise<KeyboardConfig>;
  write(config: KeyboardConfig, change: KeyChange): Promise<void>;
  backup(config: KeyboardConfig): Promise<void>;
};

const invalidVersion = () =>
  Error('保存版のデータ形式が不正です。安全のため読み込みを停止しました。');

function boundedString(value: unknown, max: number, allowEmpty = true) {
  return (
    typeof value === 'string' &&
    value.length <= max &&
    (allowEmpty || value.trim().length > 0)
  );
}

function isIsoDate(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)
  )
    return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  const normalizedInput = value.includes('.')
    ? value.replace(
        /\.(\d{1,3})Z$/,
        (_, digits: string) => `.${digits.padEnd(3, '0')}Z`,
      )
    : value.replace(/Z$/, '.000Z');
  return new Date(parsed).toISOString() === normalizedInput;
}

function parseConfig(value: unknown): KeyboardConfig {
  if (!value || typeof value !== 'object') throw invalidVersion();
  const config = value as KeyboardConfig;
  if (
    !boundedString(config.id, 200, false) ||
    !boundedString(config.name, 100) ||
    !['sample', 'device'].includes(config.mode) ||
    !Number.isInteger(config.protocol) ||
    config.protocol < 0 ||
    config.protocol > 6 ||
    !Number.isInteger(config.rows) ||
    config.rows < 1 ||
    config.rows > 64 ||
    !Number.isInteger(config.cols) ||
    config.cols < 1 ||
    config.cols > 64 ||
    !Array.isArray(config.layers) ||
    config.layers.length < 1 ||
    config.layers.length > 32 ||
    config.rows * config.cols * config.layers.length > 32768 ||
    !Array.isArray(config.keys) ||
    config.keys.length < 1 ||
    (config.layoutWarning !== null && !boundedString(config.layoutWarning, 500))
  )
    throw invalidVersion();

  const layerSize = config.rows * config.cols;
  for (let layerIndex = 0; layerIndex < config.layers.length; layerIndex++) {
    if (!Object.prototype.hasOwnProperty.call(config.layers, layerIndex))
      throw invalidVersion();
    const layer = config.layers[layerIndex];
    if (!Array.isArray(layer) || layer.length !== layerSize)
      throw invalidVersion();
    for (let cellIndex = 0; cellIndex < layer.length; cellIndex++) {
      if (!Object.prototype.hasOwnProperty.call(layer, cellIndex))
        throw invalidVersion();
      const code = layer[cellIndex];
      if (!Number.isInteger(code) || code < 0 || code > 0xffff)
        throw invalidVersion();
    }
  }

  const addresses = new Set<string>();
  for (const key of config.keys) {
    if (!key || typeof key !== 'object') throw invalidVersion();
    if (
      !Number.isInteger(key.row) ||
      key.row < 0 ||
      key.row >= config.rows ||
      !Number.isInteger(key.col) ||
      key.col < 0 ||
      key.col >= config.cols ||
      ![key.x, key.y, key.originX, key.originY].every(
        (number) =>
          typeof number === 'number' &&
          Number.isFinite(number) &&
          Math.abs(number) <= 4096,
      ) ||
      ![key.width, key.height].every(
        (number) =>
          typeof number === 'number' &&
          Number.isFinite(number) &&
          number > 0 &&
          number <= 10,
      ) ||
      typeof key.rotation !== 'number' ||
      !Number.isFinite(key.rotation) ||
      Math.abs(key.rotation) > 360
    )
      throw invalidVersion();
    const address = `${key.row}:${key.col}`;
    if (addresses.has(address)) throw invalidVersion();
    addresses.add(address);
  }
  return {
    id: config.id,
    name: config.name,
    rows: config.rows,
    cols: config.cols,
    protocol: config.protocol,
    keys: config.keys.map((key) => ({
      row: key.row,
      col: key.col,
      x: key.x,
      y: key.y,
      width: key.width,
      height: key.height,
      rotation: key.rotation,
      originX: key.originX,
      originY: key.originY,
    })),
    layers: config.layers.map((layer) => [...layer]),
    layoutWarning: config.layoutWarning,
    mode: config.mode,
  };
}

export function createVersion(
  config: KeyboardConfig,
  name: string,
  kind: 'manual' | 'automatic' = 'manual',
): KeymapVersion {
  const normalizedName = typeof name === 'string' ? name.trim() : '';
  if (!normalizedName || normalizedName.length > 80)
    throw Error('保存版の名前は1〜80文字で入力してください。');
  if (kind !== 'manual' && kind !== 'automatic')
    throw Error('保存版の種類が不正です。');
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: normalizedName,
    createdAt: new Date().toISOString(),
    kind,
    config: parseConfig(config),
  };
}

export function parseVersion(value: unknown): KeymapVersion {
  if (!value || typeof value !== 'object') throw invalidVersion();
  const version = value as KeymapVersion;
  if (
    version.schemaVersion !== 1 ||
    typeof version.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,80}$/.test(version.id) ||
    !boundedString(version.name, 80, false) ||
    version.name !== version.name.trim() ||
    !isIsoDate(version.createdAt) ||
    !['manual', 'automatic'].includes(version.kind)
  )
    throw invalidVersion();
  return {
    schemaVersion: 1,
    id: version.id,
    name: version.name,
    createdAt: version.createdAt,
    kind: version.kind,
    config: parseConfig(version.config),
  };
}

function physicalAddresses(config: KeyboardConfig) {
  return new Set(config.keys.map((key) => `${key.row}:${key.col}`));
}

function assertCompatible(current: KeyboardConfig, target: KeyboardConfig) {
  if (
    current.id !== target.id ||
    current.mode !== target.mode ||
    current.protocol !== target.protocol ||
    current.rows !== target.rows ||
    current.cols !== target.cols ||
    current.layers.length !== target.layers.length ||
    !samePhysicalAddresses(current, target)
  )
    throw Error('この保存版は現在のキーボードと互換性がありません。');
}

export function diffVersion(
  currentValue: KeyboardConfig,
  targetValue: KeyboardConfig,
): KeyChange[] {
  const current = parseConfig(currentValue);
  const target = parseConfig(targetValue);
  assertCompatible(current, target);
  const changes: KeyChange[] = [];
  for (let layer = 0; layer < current.layers.length; layer++) {
    for (let index = 0; index < current.rows * current.cols; index++) {
      const before = current.layers[layer][index];
      const after = target.layers[layer][index];
      if (before !== after)
        changes.push({
          layer,
          row: Math.floor(index / current.cols),
          col: index % current.cols,
          before,
          after,
        });
    }
  }
  return changes;
}

function protectedCode(code: number) {
  return code === 40 || code === 41 || (code >= 224 && code <= 231);
}

const SAFE_PLAN_INSPECTION_LIMIT = 4096;
const SAFE_PLAN_DEPTH_LIMIT = 128;

function planSafeWrites(current: KeyboardConfig, changes: KeyChange[]) {
  const required = new Set<number>();
  const counts = new Map<number, number>();
  for (const key of current.keys) {
    const code = current.layers[0][key.row * current.cols + key.col];
    if (!protectedCode(code)) continue;
    required.add(code);
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const afterWrite = (before: Map<number, number>, change: KeyChange) => {
    const after = new Map(before);
    if (change.layer !== 0) return after;
    if (protectedCode(change.before))
      after.set(change.before, (after.get(change.before) ?? 0) - 1);
    if (protectedCode(change.after))
      after.set(change.after, (after.get(change.after) ?? 0) + 1);
    return after;
  };
  const safe = (candidate: Map<number, number>) =>
    [...required].every((code) => (candidate.get(code) ?? 0) > 0);
  const additions = changes.filter(
    (change) =>
      change.layer === 0 &&
      !protectedCode(change.before) &&
      protectedCode(change.after),
  );
  const constrained = changes.filter(
    (change) => change.layer === 0 && protectedCode(change.before),
  );
  const neutral = changes.filter(
    (change) =>
      change.layer !== 0 ||
      (!protectedCode(change.before) && !protectedCode(change.after)),
  );
  const countsAfterAdditions = additions.reduce(afterWrite, counts);
  const failed = new Set<string>();
  let inspections = 0;
  let exhausted = constrained.length > SAFE_PLAN_DEPTH_LIMIT;
  const search = (
    pending: { change: KeyChange; index: number }[],
    currentCounts: Map<number, number>,
  ): KeyChange[] | null => {
    if (exhausted) return null;
    if (pending.length === 0) return [];
    const state = `${pending.map(({ index }) => index).join(',')}|${[
      ...required,
    ]
      .map((code) => `${code}:${currentCounts.get(code) ?? 0}`)
      .join(',')}`;
    if (failed.has(state)) return null;

    for (let index = 0; index < pending.length; index++) {
      inspections++;
      if (inspections > SAFE_PLAN_INSPECTION_LIMIT) {
        exhausted = true;
        return null;
      }
      const candidate = pending[index];
      const nextCounts = afterWrite(currentCounts, candidate.change);
      if (!safe(nextCounts)) continue;
      const remainder = search(
        pending.filter((_, pendingIndex) => pendingIndex !== index),
        nextCounts,
      );
      if (remainder) return [candidate.change, ...remainder];
      if (exhausted) return null;
    }
    failed.add(state);
    return null;
  };

  const ordered = search(
    constrained.map((change, index) => ({ change: { ...change }, index })),
    countsAfterAdditions,
  );
  if (!ordered)
    throw Error(
      '基本レイヤーの保護キーを安全な順序で復元できないため、復元を停止しました。',
    );
  return [...additions, ...ordered, ...neutral];
}

function assertSafePlan(
  current: KeyboardConfig,
  target: KeyboardConfig,
  changes: KeyChange[],
) {
  const addresses = physicalAddresses(current);
  for (const change of changes) {
    if (!addresses.has(`${change.row}:${change.col}`))
      throw Error('表示されていない物理キーは安全に復元できません。');
    if (!isEditable(change.before) || !isEditable(change.after))
      throw Error(
        '高度なキーコードを変更する保存版は安全に復元できません。現在の割り当ては保持されています。',
      );
  }

  const currentProtected = new Set(
    current.keys
      .map((key) => current.layers[0][key.row * current.cols + key.col])
      .filter(protectedCode),
  );
  const targetProtected = new Set(
    target.keys
      .map((key) => target.layers[0][key.row * target.cols + key.col])
      .filter(protectedCode),
  );
  for (const code of currentProtected) {
    if (!targetProtected.has(code))
      throw Error(
        `基本レイヤーの ${keyLabel(code)} が失われるため、復元を停止しました。`,
      );
  }
}

function applyToConfig(config: KeyboardConfig, change: KeyChange) {
  const next = structuredClone(config);
  next.layers[change.layer][change.row * next.cols + change.col] = change.after;
  return next;
}

export async function restoreVersion(
  currentValue: KeyboardConfig,
  targetValue: KeyboardConfig,
  io: VersionIO,
): Promise<{ config: KeyboardConfig }> {
  const current = parseConfig(currentValue);
  const target = parseConfig(targetValue);
  const changes = diffVersion(current, target);
  assertSafePlan(current, target, changes);
  const ordered = planSafeWrites(current, changes);

  const fresh = parseConfig(await io.read());
  if (!sameMap(current, fresh))
    throw Error(
      'キーマップが別の場所で変更されています。再読み込みして差分を作り直してください。',
    );
  if (changes.length === 0) return { config: fresh };

  await io.backup(structuredClone(fresh));
  let beforeWrite: KeyboardConfig;
  try {
    beforeWrite = parseConfig(await io.read());
  } catch (error) {
    throw Error(
      `バックアップ後にキーマップを再確認できませんでした。書き込みは行っていません。${error instanceof Error ? ` ${error.message}` : ''}`,
    );
  }
  if (!sameMap(fresh, beforeWrite))
    throw Error(
      'バックアップ中にキーマップが変更されています。再読み込みして差分を作り直してください。',
    );
  let working = structuredClone(beforeWrite);
  try {
    for (const change of ordered) {
      await io.write(working, { ...change });
      working = applyToConfig(working, change);
    }
    const verified = parseConfig(await io.read());
    if (!sameMap(verified, target))
      throw Error('書き込み後のキーマップが保存版と一致しません。');
    return { config: verified };
  } catch (error) {
    throw Error(
      `復元結果を確認できませんでした。バックアップは残っています。再接続後に復元してください。${error instanceof Error ? ` ${error.message}` : ''}`,
    );
  }
}
