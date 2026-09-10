import { parseVersion, type KeymapVersion } from '../keyboard/versions';

export function encodeVersion(version: KeymapVersion) {
  const saved = parseVersion(version);
  const configJson = JSON.stringify(saved.config);
  if (configJson.length > 400000)
    throw Error('キーマップがクラウド保存のサイズ上限を超えています。');
  return {
    schemaVersion: saved.schemaVersion,
    name: saved.name,
    kind: saved.kind,
    createdAt: saved.createdAt,
    deviceId: saved.config.id,
    configJson,
  };
}

export function decodeVersion(id: string, data: unknown): KeymapVersion {
  if (!data || typeof data !== 'object')
    throw Error('保存版の形式が不正です。');
  const fields = data as Record<string, unknown>;
  if (
    typeof fields.configJson !== 'string' ||
    fields.configJson.length > 400000
  )
    throw Error('保存版のデータが不正です。');
  const version = parseVersion({
    id,
    schemaVersion: fields.schemaVersion,
    name: fields.name,
    kind: fields.kind,
    createdAt: fields.createdAt,
    config: JSON.parse(fields.configJson),
  });
  if (version.config.id !== fields.deviceId)
    throw Error('保存版のキーボード情報が一致しません。');
  return version;
}
