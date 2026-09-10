'use client';
import type { CSSProperties } from 'react';
import {
  keyHint,
  keyLabel,
  keyName,
  isEditable,
} from '@/lib/keyboard/keycodes';
import type {
  KeyboardConfig,
  PhysicalKey,
  KeyChange,
} from '@/lib/keyboard/types';

function bounds(keys: PhysicalKey[]) {
  const points = keys.flatMap((k) =>
    [
      [k.x, k.y],
      [k.x + k.width, k.y],
      [k.x, k.y + k.height],
      [k.x + k.width, k.y + k.height],
    ].map(([x, y]) => {
      const r = (k.rotation * Math.PI) / 180;
      return {
        x:
          k.originX +
          (x - k.originX) * Math.cos(r) -
          (y - k.originY) * Math.sin(r),
        y:
          k.originY +
          (x - k.originX) * Math.sin(r) +
          (y - k.originY) * Math.cos(r),
      };
    }),
  );
  const minX = Math.min(...points.map((p) => p.x)),
    minY = Math.min(...points.map((p) => p.y));
  return {
    minX,
    minY,
    width: Math.max(...points.map((p) => p.x)) - minX,
    height: Math.max(...points.map((p) => p.y)) - minY,
  };
}
export function KeyboardLayout({
  config,
  layer,
  selected,
  change,
  disabled,
  highlighted = [],
  onSelect,
}: {
  config: KeyboardConfig;
  layer: number;
  selected: PhysicalKey | null;
  change: KeyChange | null;
  disabled: boolean;
  highlighted?: string[];
  onSelect: (key: PhysicalKey) => void;
}) {
  const b = bounds(config.keys);
  const padding = 0.35;
  const width = b.width + padding * 2;
  const height = b.height + padding * 2;
  return (
    <div className="keyboard-scroll" aria-label={`Layer ${layer} のキーボード`}>
      <div
        className="keyboard-canvas"
        style={
          {
            maxWidth: width * 64,
            aspectRatio: `${width} / ${height}`,
            '--key-unit': `${100 / width}cqw`,
          } as CSSProperties
        }
      >
        {config.keys.map((key) => {
          const code = config.layers[layer][key.row * config.cols + key.col];
          const active = selected?.row === key.row && selected?.col === key.col;
          const changed =
            change?.layer === layer &&
            change.row === key.row &&
            change.col === key.col;
          const shown = changed ? change.after : code;
          const label = keyLabel(shown, config.protocol);
          const hint = keyHint(shown, config.protocol);
          const css: CSSProperties = {
            left: `${((key.x - b.minX + padding) / width) * 100}%`,
            top: `${((key.y - b.minY + padding) / height) * 100}%`,
            width: `calc(${(key.width / width) * 100}% - var(--key-gap))`,
            height: `calc(${(key.height / height) * 100}% - var(--key-gap))`,
            transform: `rotate(${key.rotation}deg)`,
            transformOrigin: `${((key.originX - key.x) / width) * 100}cqw ${((key.originY - key.y) / width) * 100}cqw`,
          };
          return (
            <button
              type="button"
              key={`${key.row},${key.col}`}
              className={`keycap ${active ? 'selected' : ''} ${!isEditable(code) ? 'special' : ''} ${code === 1 ? 'transparent-key' : ''} ${highlighted.includes(`${layer}:${key.row}:${key.col}`) ? 'version-changed' : ''}`}
              style={css}
              disabled={disabled}
              aria-pressed={active}
              aria-label={`行 ${key.row} 列 ${key.col}: ${keyName(code, config.protocol)}`}
              title={`行 ${key.row} / 列 ${key.col} · ${keyName(code, config.protocol)}`}
              onClick={() => onSelect(key)}
            >
              <span className={label.length > 4 ? 'key-long' : ''}>
                {label}
              </span>
              {hint && <small className="key-hint">{hint}</small>}
              {changed && <i className="change-dot" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
