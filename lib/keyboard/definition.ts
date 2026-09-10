import type { PhysicalKey } from './types';

const labelOrder = [
  [0, 6, 2, 8, 9, 11, 3, 5, 1, 4, 7, 10],
  [1, 7, -1, -1, 9, 11, 4, -1, -1, -1, -1, 10],
  [3, -1, 5, -1, 9, 11, -1, -1, 4, -1, -1, 10],
  [4, -1, -1, -1, 9, 11, -1, -1, -1, -1, -1, 10],
  [0, 6, 2, 8, 10, -1, 3, 5, 1, 4, 7, -1],
  [1, 7, -1, -1, 10, -1, 4, -1, -1, -1, -1, -1],
  [3, -1, 5, -1, 10, -1, -1, -1, 4, -1, -1, -1],
  [4, -1, -1, -1, 10, -1, -1, -1, -1, -1, -1, -1],
];
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('キーボード定義の形式を読み取れません。');
  return value as Record<string, unknown>;
}
function dimension(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 64
  )
    throw Error('キーボード行列のサイズが不正です。');
  return value;
}
export function parseDefinition(raw: unknown) {
  const def = object(raw),
    matrix = object(def.matrix),
    layouts = object(def.layouts);
  const rows = dimension(matrix.rows),
    cols = dimension(matrix.cols);
  if (!Array.isArray(layouts.keymap) || layouts.keymap.length > 1024)
    throw Error('キーボードの物理レイアウトがありません。');
  const keys: PhysicalKey[] = [];
  const seen = new Set<string>();
  let x = 0,
    y = 0,
    originX = 0,
    originY = 0,
    rotation = 0,
    width = 1,
    height = 1,
    align = 4,
    decal = false;
  let layoutWarning: string | null = null;
  // Layout labels can be firmware information, not selectable physical variants.
  // Only a variant marker on an actual key requires the conservative matrix view.
  let matrixView = false;
  for (const line of layouts.keymap) {
    if (!Array.isArray(line)) continue;
    for (const item of line) {
      if (typeof item === 'string') {
        const labels: string[] = [];
        item
          .split('\n')
          .slice(0, 12)
          .forEach((label, i) => {
            const index = labelOrder[align][i];
            if (index >= 0) labels[index] = label;
          });
        const match = labels[0]?.trim().match(/^(\d+),(\d+)$/);
        if (match && labels[4] !== 'e' && !decal) {
          if (/^\d+,\d+$/.test(labels[8]?.trim() ?? '')) matrixView = true;
          const row = Number(match[1]),
            col = Number(match[2]);
          if (row >= rows || col >= cols)
            throw Error('物理レイアウトの座標が行列の範囲外です。');
          const id = `${row},${col}`;
          if (!seen.has(id)) {
            keys.push({
              row,
              col,
              x,
              y,
              width,
              height,
              rotation,
              originX,
              originY,
            });
            seen.add(id);
          }
        }
        x += width;
        width = height = 1;
        decal = false;
      } else {
        const prop = object(item);
        for (const name of ['x', 'y', 'rx', 'ry', 'r', 'w', 'h', 'a']) {
          if (
            name in prop &&
            (typeof prop[name] !== 'number' ||
              !Number.isFinite(prop[name]) ||
              Math.abs(prop[name] as number) > 360)
          )
            throw Error('物理レイアウトの値が不正です。');
        }
        if ('r' in prop) rotation = prop.r as number;
        if ('rx' in prop) {
          originX = prop.rx as number;
          x = originX;
          y = originY;
        }
        if ('ry' in prop) {
          originY = prop.ry as number;
          x = originX;
          y = originY;
        }
        if ('x' in prop) x += prop.x as number;
        if ('y' in prop) y += prop.y as number;
        if ('w' in prop) width = prop.w as number;
        if ('h' in prop) height = prop.h as number;
        if (width <= 0 || height <= 0 || width > 10 || height > 10)
          throw Error('キーの大きさが不正です。');
        if ('a' in prop) {
          align = prop.a as number;
          if (!Number.isInteger(align) || align < 0 || align > 7)
            throw Error('キーラベルの位置が不正です。');
        }
        if ('d' in prop) decal = Boolean(prop.d);
      }
    }
    y += 1;
    x = originX;
  }
  if (!keys.length) throw Error('読み取り可能な物理キーがありません。');
  if (matrixView)
    layoutWarning =
      '複数の物理レイアウトがあるため、行列座標で表示しています。';
  return {
    name:
      typeof def.name === 'string' ? def.name.slice(0, 100) : 'Vial Keyboard',
    rows,
    cols,
    keys: matrixView
      ? keys.map((key) => ({
          ...key,
          x: key.col,
          y: key.row,
          width: 1,
          height: 1,
          rotation: 0,
          originX: 0,
          originY: 0,
        }))
      : keys,
    layoutWarning,
  };
}

export async function decompressDefinition(
  bytes: Uint8Array,
): Promise<unknown> {
  const { XzReadableStream } = await import('xz-decompress');
  const stream = new XzReadableStream(
    new Blob([new Uint8Array(bytes)]).stream(),
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 2 * 1024 * 1024)
        throw Error('展開したキーボード定義が大きすぎます。');
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }
  return JSON.parse(new TextDecoder().decode(output));
}
