import { describe, expect, it } from 'vitest';
import { parseDefinition } from '../lib/keyboard/definition';
import { isEditable, keyLabel, keyName } from '../lib/keyboard/keycodes';

describe('physical layout with firmware information', () => {
  const split = {
    name: 'Split with firmware label',
    matrix: { rows: 8, cols: 7 },
    layouts: {
      labels: [['Firmware', 'v1.12']],
      keymap: [
        [{ x: 0.5 }, '0,0', '0,1', { x: 14.5 }, '4,1', '4,0'],
        [{ x: 3.5, y: -0.375 }, '1,3', { x: 10.5 }, '5,3'],
        [{ r: 16, rx: 6.27, ry: 4.6, y: -1.02 }, '3,5'],
        [{ r: -16, rx: 13.23, x: -1, y: -1.02 }, '7,5'],
      ],
    },
  };

  it('keeps split offsets, mirrored matrix columns and thumb rotation despite metadata labels', () => {
    const result = parseDefinition(split);
    expect(result.layoutWarning).toBeNull();
    expect(
      result.keys.slice(0, 4).map((k) => [k.row, k.col, k.x, k.y]),
    ).toEqual([
      [0, 0, 0.5, 0],
      [0, 1, 1.5, 0],
      [4, 1, 17, 0],
      [4, 0, 18, 0],
    ]);
    expect(result.keys[4]).toMatchObject({ x: 3.5, y: 0.625 });
    expect(result.keys[6]).toMatchObject({
      row: 3,
      col: 5,
      x: 6.27,
      rotation: 16,
      originY: 4.6,
    });
    expect(result.keys[7]).toMatchObject({
      row: 7,
      col: 5,
      x: 12.23,
      rotation: -16,
    });
  });

  it('still identifies real physical variants from key labels and avoids guessing a selected option', () => {
    const result = parseDefinition({
      ...split,
      layouts: {
        labels: [['Spacebar', 'Full', 'Split']],
        keymap: [[{ x: 3 }, '0,0\n\n\n0,0', { x: 3 }, '0,0\n\n\n0,1']],
      },
    });
    expect(result.layoutWarning).toContain('行列座標');
    expect(result.keys).toHaveLength(1);
    expect(result.keys[0]).toMatchObject({ row: 0, col: 0, x: 0, y: 0 });
  });

  it('excludes encoder rotation labels while retaining the encoder press address', () => {
    const result = parseDefinition({
      ...split,
      layouts: {
        ...split.layouts,
        keymap: [['0,1\n\n\n\n\n\n\n\n\ne', { x: 2 }, '2,6']],
      },
    });
    expect(result.keys).toHaveLength(1);
    expect(result.keys[0]).toMatchObject({ row: 2, col: 6, x: 3 });
    expect(result.layoutWarning).toBeNull();
  });
});

describe('read-only layer key descriptions', () => {
  it('explains CornixLP momentary layers and layer-with-Shift without enabling editing', () => {
    expect(keyLabel(0x5222, 6)).toBe('L2');
    expect(keyName(0x5222, 6)).toBe('MO(2) · 押している間、Layer 2');
    expect(keyLabel(0x5022, 6)).toBe('L1+⇧');
    expect(keyName(0x5022, 6)).toBe(
      'LM(1, LShift) · 押している間、Layer 1 と LShift',
    );
    for (const code of [0x5221, 0x5222, 0x5022])
      expect(isEditable(code)).toBe(false);
  });

  it('does not reinterpret another protocol or unknown values', () => {
    expect(keyLabel(0x5222, 5)).toBe('0x5222');
    expect(keyName(0xffff, 6)).toBe('0xFFFF');
    expect(keyLabel(4, 5)).toBe('A');
  });
});
