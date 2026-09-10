import { validateChange } from './keycodes';
import type {
  KeyboardConfig,
  KeyChange,
  Snapshot,
  TransactionIO,
} from './types';

export function samePhysicalAddresses(a: KeyboardConfig, b: KeyboardConfig) {
  const addresses = (config: KeyboardConfig) =>
    config.keys
      .map((key) => `${key.row}:${key.col}`)
      .sort()
      .join('|');
  return addresses(a) === addresses(b);
}

export const sameMap = (a: KeyboardConfig, b: KeyboardConfig) =>
  a.id === b.id &&
  a.mode === b.mode &&
  a.protocol === b.protocol &&
  a.rows === b.rows &&
  a.cols === b.cols &&
  samePhysicalAddresses(a, b) &&
  JSON.stringify(a.layers) === JSON.stringify(b.layers);
export function changedConfig(
  config: KeyboardConfig,
  change: KeyChange,
): KeyboardConfig {
  const next = structuredClone(config);
  next.layers[change.layer][change.row * config.cols + change.col] =
    change.after;
  return next;
}

export async function applyChange(
  config: KeyboardConfig,
  change: KeyChange,
  io: TransactionIO,
) {
  validateChange(config, change);
  const fresh = await io.read();
  if (!sameMap(config, fresh))
    throw Error(
      'キーマップが別の場所で変更されています。再読み込みして差分を作り直してください。',
    );
  const snapshot: Snapshot = {
    version: 1,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    before: structuredClone(fresh),
    change: { ...change },
    status: 'prepared',
  };
  io.save(snapshot); // A persistence failure must happen before any device write.
  try {
    await io.write(fresh, change);
    const verified = await io.read();
    if (!sameMap(verified, changedConfig(fresh, change)))
      throw Error('書き込み結果が一致しません。');
    snapshot.status = 'applied';
    io.save(snapshot);
    return { config: verified, snapshot };
  } catch (error) {
    snapshot.status = 'uncertain';
    try {
      io.save(snapshot);
    } catch {
      /* The prepared snapshot was already persisted. */
    }
    throw Error(
      `適用結果を確認できませんでした。再接続後、履歴から復元してください。${error instanceof Error ? ` ${error.message}` : ''}`,
    );
  }
}

export async function restoreSnapshot(snapshot: Snapshot, io: TransactionIO) {
  const fresh = await io.read();
  const expected = changedConfig(snapshot.before, snapshot.change);
  if (!sameMap(fresh, expected) && !sameMap(fresh, snapshot.before))
    throw Error(
      'この履歴と現在のキーマップが一致しません。別の変更を保護するため復元を停止しました。',
    );
  // The existing snapshot remains available until the restore is verified.
  if (!sameMap(fresh, snapshot.before)) {
    await io.write(fresh, {
      ...snapshot.change,
      before: snapshot.change.after,
      after: snapshot.change.before,
    });
  }
  const verified = await io.read();
  if (!sameMap(verified, snapshot.before))
    throw Error(
      '復元結果を確認できません。再接続して履歴から復元してください。',
    );
  const restored: Snapshot = { ...snapshot, status: 'restored' };
  io.save(restored);
  return { config: verified, snapshot: restored };
}
