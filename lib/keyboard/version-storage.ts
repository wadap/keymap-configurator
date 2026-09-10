import { parseVersion, type KeymapVersion } from './versions';

const storageKey = (owner: string) => `cornix.keymap.versions.v1:${owner}`;

export function readVersions(
  owner: string,
  storage: Pick<Storage, 'getItem'> = localStorage,
): KeymapVersion[] {
  const raw = storage.getItem(storageKey(owner));
  if (raw === null) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw Error(
      '保存版のデータを読み込めません。安全のため書き込みを停止しました。',
    );
  }
  if (!Array.isArray(value))
    throw Error('保存版のデータ形式が不正です。書き込みを停止しました。');
  const versions = value.map(parseVersion);
  const ids = new Set<string>();
  for (const version of versions) {
    if (ids.has(version.id))
      throw Error(
        '保存版に同じIDのデータが重複しています。書き込みを停止しました。',
      );
    ids.add(version.id);
  }
  return versions;
}

export function saveVersionLocal(
  value: KeymapVersion,
  owner: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
): void {
  const version = parseVersion(value);
  const versions = readVersions(owner, storage);
  const duplicate = versions.find((saved) => saved.id === version.id);
  if (duplicate) {
    if (JSON.stringify(duplicate) === JSON.stringify(version)) return;
    throw Error('同じIDの保存版は変更や上書きができません。');
  }
  storage.setItem(storageKey(owner), JSON.stringify([version, ...versions]));
}
