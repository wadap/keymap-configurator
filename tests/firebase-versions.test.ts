import { describe, expect, it } from 'vitest';
import { encodeVersion, decodeVersion } from '../lib/firebase/version-codec';
import { sampleConfig } from '../lib/keyboard/sample';

describe('Firestore version encoding', () => {
  const version = () => ({
    schemaVersion: 1 as const,
    id: 'version-one',
    name: '普段用',
    kind: 'manual' as const,
    createdAt: '2026-09-10T00:00:00.000Z',
    config: sampleConfig(),
  });
  it('round-trips every raw layer value without nested Firestore arrays', () => {
    const saved = version();
    saved.config.layers[2][5] = 0xffff;
    const encoded = encodeVersion(saved);
    expect(typeof encoded.configJson).toBe('string');
    expect(decodeVersion(saved.id, encoded)).toEqual(saved);
    expect(encoded).not.toHaveProperty('config');
  });
  it('rejects corrupted payload and inconsistent device metadata', () => {
    const encoded = encodeVersion(version());
    expect(() => decodeVersion('v', { ...encoded, configJson: '{' })).toThrow();
    expect(() =>
      decodeVersion('v', { ...encoded, deviceId: 'foreign' }),
    ).toThrow();
    expect(() =>
      decodeVersion('v', { ...encoded, configJson: '{}' }),
    ).toThrow();
  });
});
