import type { KeyboardConfig, PhysicalKey } from './types';

export function sampleConfig(): KeyboardConfig {
  const keys: PhysicalKey[] = [];
  for (let side = 0; side < 2; side++) {
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 6; col++) {
        const stagger = [0.3, 0.15, 0, 0.12, 0.25, 0.4];
        keys.push({
          row: row + side * 4,
          col,
          x: col + side * 7.6,
          y: row + stagger[side === 0 ? col : 5 - col],
          width: 1,
          height: 1,
          rotation: 0,
          originX: 0,
          originY: 0,
        });
      }
    for (let col = 0; col < 3; col++)
      keys.push({
        row: 3 + side * 4,
        col,
        x: (side === 0 ? 2.8 : 7.8) + col * 1.08,
        y: 3.65 + (side === 0 ? col : 2 - col) * 0.12,
        width: 1,
        height: 1,
        rotation: side === 0 ? 12 : -12,
        originX: (side === 0 ? 2.8 : 7.8) + col * 1.08,
        originY: 3.65,
      });
  }
  const layers = Array.from({ length: 4 }, () => Array(48).fill(1) as number[]);
  const base = [
    [43, 20, 26, 8, 21, 23],
    [57, 4, 22, 7, 9, 10],
    [225, 29, 27, 6, 25, 5],
    [224, 227, 0x5221, 0, 0, 0],
    [28, 24, 12, 18, 19, 42],
    [11, 13, 14, 15, 51, 52],
    [17, 16, 54, 55, 56, 229],
    [44, 0x5222, 40, 0, 0, 0],
  ];
  layers[0] = base.flat();
  const symbols = [
    41, 30, 31, 32, 33, 34, 43, 47, 48, 45, 46, 49, 225, 53, 51, 52, 54, 55,
  ];
  symbols.forEach((code, i) => {
    layers[1][i] = code;
  });
  [35, 36, 37, 38, 39, 42, 80, 81, 82, 79, 44, 40].forEach((code, i) => {
    layers[1][24 + i] = code;
  });
  Array.from({ length: 12 }, (_, i) => i + 58).forEach((code, i) => {
    layers[2][i] = code;
  });
  [74, 78, 75, 77, 76, 41, 80, 81, 82, 79, 44, 40].forEach((code, i) => {
    layers[2][24 + i] = code;
  });
  return {
    id: 'sample:cornix-42',
    name: 'Cornix',
    rows: 8,
    cols: 6,
    protocol: 6,
    keys,
    layers,
    layoutWarning: null,
    mode: 'sample',
  };
}
