import type { KeyboardConfig, KeyChange } from './types';

export type KeyOption = {
  code: number;
  label: string;
  name: string;
  group: string;
};
export const keyOptions: KeyOption[] = [
  ...Array.from({ length: 26 }, (_, i) => ({
    code: i + 4,
    label: String.fromCharCode(65 + i),
    name: `KC_${String.fromCharCode(65 + i)}`,
    group: '文字',
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    code: i + 30,
    label: String((i + 1) % 10),
    name: `KC_${(i + 1) % 10}`,
    group: '数字・記号',
  })),
  ...(
    [
      [40, 'Enter', 'ENT'],
      [41, 'Esc', 'ESC'],
      [42, '⌫', 'BSPC'],
      [43, 'Tab', 'TAB'],
      [44, 'Space', 'SPC'],
      [45, '−', 'MINS'],
      [46, '=', 'EQL'],
      [47, '[', 'LBRC'],
      [48, ']', 'RBRC'],
      [49, '\\', 'BSLS'],
      [51, ';', 'SCLN'],
      [52, "'", 'QUOT'],
      [53, '`', 'GRV'],
      [54, ',', 'COMM'],
      [55, '.', 'DOT'],
      [56, '/', 'SLSH'],
      [57, 'Caps', 'CAPS'],
      [73, 'Ins', 'INS'],
      [74, 'Home', 'HOME'],
      [75, 'PgUp', 'PGUP'],
      [76, 'Del', 'DEL'],
      [77, 'End', 'END'],
      [78, 'PgDn', 'PGDN'],
      [79, '→', 'RGHT'],
      [80, '←', 'LEFT'],
      [81, '↓', 'DOWN'],
      [82, '↑', 'UP'],
    ] as const
  ).map(([code, label, name]) => ({
    code,
    label,
    name: `KC_${name}`,
    group: code >= 45 && code <= 56 ? '数字・記号' : '操作',
  })),
  ...Array.from({ length: 12 }, (_, i) => ({
    code: i + 58,
    label: `F${i + 1}`,
    name: `KC_F${i + 1}`,
    group: '機能',
  })),
  ...['LCtrl', 'LShift', 'LAlt', 'LGui', 'RCtrl', 'RShift', 'RAlt', 'RGui'].map(
    (label, i) => ({
      code: 224 + i,
      label,
      name: `KC_${label.toUpperCase()}`,
      group: '修飾キー',
    }),
  ),
];
const optionsByCode = new Map(keyOptions.map((k) => [k.code, k]));
export const hexCode = (code: number) =>
  `0x${code.toString(16).toUpperCase().padStart(4, '0')}`;

// Display only: Vial v6 keycode ranges. These remain outside the editable allowlist.
function layerAction(code: number, protocol: number) {
  if (protocol !== 6) return null;
  if (code >= 0x5220 && code <= 0x523f) {
    const layer = code & 0x1f;
    return {
      label: `L${layer}`,
      name: `MO(${layer}) · 押している間、Layer ${layer}`,
    };
  }
  if (code >= 0x5000 && code <= 0x51ff && code & 0x0f) {
    const layer = (code >> 5) & 0x0f;
    const side = code & 0x10 ? 'R' : 'L';
    const modifiers = ['Ctrl', 'Shift', 'Alt', 'Gui']
      .filter((_, bit) => code & (1 << bit))
      .map((name) => `${side}${name}`)
      .join('+');
    return {
      label: `L${layer}+${(code & 0x0f) === 2 ? '⇧' : '修飾'}`,
      name: `LM(${layer}, ${modifiers}) · 押している間、Layer ${layer} と ${modifiers}`,
    };
  }
  return null;
}
export function keyLabel(code: number, protocol = 6): string {
  if (code === 0) return '—';
  if (code === 1) return '▽';
  return (
    optionsByCode.get(code)?.label ??
    layerAction(code, protocol)?.label ??
    hexCode(code)
  );
}
export const keyHint = (code: number, protocol = 6) =>
  layerAction(code, protocol) ? '押す間' : null;
export const keyName = (code: number, protocol = 6) =>
  optionsByCode.get(code)?.name ??
  layerAction(code, protocol)?.name ??
  (code === 1
    ? '透過（下のレイヤー）'
    : code === 0
      ? '未割り当て'
      : hexCode(code));
export const isEditable = (code: number) =>
  code === 0 || code === 1 || optionsByCode.has(code);

export function validateChange(
  config: KeyboardConfig,
  change: KeyChange,
): void {
  const { layer, row, col, before, after } = change;
  if (
    ![layer, row, col].every(Number.isInteger) ||
    layer < 0 ||
    layer >= config.layers.length ||
    row < 0 ||
    row >= config.rows ||
    col < 0 ||
    col >= config.cols
  )
    throw Error('キーの位置が範囲外です。再接続してください。');
  if (!config.keys.some((k) => k.row === row && k.col === col))
    throw Error('物理キーが見つかりません。');
  if (config.layers[layer][row * config.cols + col] !== before)
    throw Error('元の割り当てが変わっています。再読み込みしてください。');
  if (!isEditable(before))
    throw Error(
      'レイヤー切替や高度な割り当ては、この最小版では編集できません。',
    );
  if (!optionsByCode.has(after))
    throw Error('一覧から通常キーまたは修飾キーを選んでください。');
  if (before === after) throw Error('変更する割り当てを選んでください。');
  if (
    layer === 0 &&
    (before === 40 || before === 41 || before >= 224) &&
    config.keys.filter(
      (k) => config.layers[0][k.row * config.cols + k.col] === before,
    ).length < 2
  ) {
    throw Error(
      `基本レイヤーにある唯一の ${keyLabel(before)} です。先に別のキーへ追加してください。`,
    );
  }
}
