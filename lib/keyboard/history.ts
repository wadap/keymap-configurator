import type { Snapshot } from './types';
import { isEditable, keyOptions } from './keycodes';

const STORAGE_KEY = 'cornix.keymap.snapshots.v1';
function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const s = value as Snapshot,
    b = s.before,
    c = s.change;
  if (
    s.version !== 1 ||
    typeof s.id !== 'string' ||
    typeof s.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(s.createdAt)) ||
    !['prepared', 'applied', 'uncertain', 'restored'].includes(s.status) ||
    !b ||
    !c
  )
    return false;
  if (
    typeof b.id !== 'string' ||
    typeof b.name !== 'string' ||
    !['sample', 'device'].includes(b.mode)
  )
    return false;
  if (
    ![b.rows, b.cols].every((n) => Number.isInteger(n) && n > 0 && n <= 64) ||
    !Array.isArray(b.layers) ||
    b.layers.length < 1 ||
    b.layers.length > 32
  )
    return false;
  if (
    !b.layers.every(
      (l) =>
        Array.isArray(l) &&
        l.length === b.rows * b.cols &&
        l.every((n) => Number.isInteger(n) && n >= 0 && n <= 65535),
    )
  )
    return false;
  if (
    !Array.isArray(b.keys) ||
    !b.keys.length ||
    b.keys.length > b.rows * b.cols ||
    !b.keys.every(
      (k) =>
        k &&
        Number.isInteger(k.row) &&
        k.row >= 0 &&
        k.row < b.rows &&
        Number.isInteger(k.col) &&
        k.col >= 0 &&
        k.col < b.cols &&
        [k.x, k.y, k.width, k.height, k.rotation, k.originX, k.originY].every(
          (n) =>
            typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 4096,
        ) &&
        k.width > 0 &&
        k.height > 0,
    )
  )
    return false;
  if (
    ![c.layer, c.row, c.col, c.before, c.after].every(Number.isInteger) ||
    c.layer < 0 ||
    c.layer >= b.layers.length ||
    c.row < 0 ||
    c.row >= b.rows ||
    c.col < 0 ||
    c.col >= b.cols
  )
    return false;
  return (
    b.keys.some((k) => k.row === c.row && k.col === c.col) &&
    isEditable(c.before) &&
    keyOptions.some((k) => k.code === c.after) &&
    c.before !== c.after &&
    b.layers[c.layer][c.row * b.cols + c.col] === c.before
  );
}

export function readHistory(
  storage: Pick<Storage, 'getItem'> = localStorage,
): Snapshot[] {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error(
      '保存済みの履歴が読めません。このブラウザでは書き込みを停止しています。',
    );
  }
  if (!Array.isArray(value) || !value.every(isSnapshot))
    throw Error('保存済みの履歴の形式が不正です。書き込みを停止しています。');
  return value;
}
export function saveSnapshot(
  snapshot: Snapshot,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
) {
  // Most recent operation first: restoring an older entry must also resume that state.
  const history = [
    snapshot,
    ...readHistory(storage).filter((s) => s.id !== snapshot.id),
  ];
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch {
    throw Error(
      '復元用データをブラウザに保存できません。空き容量とストレージ設定を確認してください。',
    );
  }
}
