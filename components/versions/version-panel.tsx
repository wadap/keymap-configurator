'use client';
import './versions.css';
import { useState } from 'react';
import {
  Archive,
  ArrowRight,
  Check,
  Cloud,
  GitCompareArrows,
  HardDrive,
  Layers,
  LoaderCircle,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { KeyboardLayout } from '@/components/keyboard/keyboard-layout';
import type { useKeyboard } from '@/components/keyboard/use-keyboard';
import type { useVersions } from './use-versions';
import { diffVersion, type KeymapVersion } from '@/lib/keyboard/versions';
import { sameMap } from '@/lib/keyboard/transactions';
import { keyLabel } from '@/lib/keyboard/keycodes';
import type {
  KeyboardConfig,
  KeyChange,
  PhysicalKey,
} from '@/lib/keyboard/types';

export function VersionPanel({
  kb,
  vault,
}: {
  kb: ReturnType<typeof useKeyboard>;
  vault: ReturnType<typeof useVersions>;
}) {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState<{
    id: string;
    current: KeyboardConfig;
  } | null>(null);
  const [layer, setLayer] = useState(0);
  const [selectedKey, setSelectedKey] = useState<PhysicalKey | null>(null);
  const [saved, setSaved] = useState('');
  const busy = Boolean(kb.busy) || vault.busy;
  const versions = vault.versions.filter(
    (v) => v.config.id === kb.config.id && v.config.mode === kb.config.mode,
  );
  const selected = versions.find((v) => v.id === preview?.id);
  let differences: KeyChange[] = [],
    incompatible = '';
  if (selected && preview) {
    try {
      differences = diffVersion(preview.current, selected.config);
    } catch (e) {
      incompatible =
        e instanceof Error ? e.message : 'この保存版は復元できません。';
    }
  }
  const stale = preview !== null && !sameMap(preview.current, kb.config);
  const canRead = kb.config.mode === 'sample' || kb.connected;
  const currentLayer = Math.min(
    layer,
    (selected?.config.layers.length ?? 1) - 1,
  );
  const chosenDifference = differences.find(
    (d) =>
      d.layer === currentLayer &&
      d.row === selectedKey?.row &&
      d.col === selectedKey?.col,
  );

  function choose(version: KeymapVersion) {
    setPreview({ id: version.id, current: structuredClone(kb.config) });
    setLayer(0);
    setSelectedKey(null);
  }
  async function save() {
    setSaved('');
    if (await kb.captureVersion((config) => vault.save(config, name))) {
      setSaved(`「${name.trim()}」を保存しました。`);
      setName('');
    }
  }
  function item(version: KeymapVersion) {
    return (
      <button
        key={version.id}
        type="button"
        className={`version-item ${selected?.id === version.id ? 'active' : ''}`}
        disabled={busy}
        onClick={() => choose(version)}
      >
        <span className="version-item-icon">
          {version.kind === 'automatic' ? (
            <Archive size={17} />
          ) : (
            <Layers size={17} />
          )}
        </span>
        <span className="version-item-main">
          <strong>{version.name}</strong>
          <time dateTime={version.createdAt}>
            {new Date(version.createdAt).toLocaleString('ja-JP')}
          </time>
        </span>
        <span className="version-location">
          {vault.cloudIds.has(version.id) ? (
            <>
              <Cloud size={13} />
              クラウド
            </>
          ) : (
            <>
              <HardDrive size={13} />
              このブラウザ
            </>
          )}
        </span>
      </button>
    );
  }
  return (
    <section className="versions-panel" aria-label="バージョン保存">
      <div className="versions-heading">
        <div>
          <h2>
            <Archive size={20} />
            バージョン
          </h2>
          <p>いつもの配置を残して、次の配置を試す。</p>
        </div>
        <span className="version-count">{versions.length} 件の保存版</span>
      </div>
      {vault.error && (
        <div className="version-message error" role="alert">
          {vault.error}
        </div>
      )}
      <div className="version-save-row">
        <div>
          <label htmlFor="version-name">現在の配置を保存</label>
          <p>全{kb.config.layers.length}レイヤーをまとめて保存します。</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim() && vault.user && canRead && !busy) void save();
          }}
        >
          <input
            id="version-name"
            maxLength={80}
            placeholder="例：普段用、親指配置の実験"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy || !vault.user}
          />
          <Button
            type="submit"
            disabled={
              busy || !vault.ready || !vault.user || !name.trim() || !canRead
            }
          >
            {busy ? <LoaderCircle className="spin" /> : <Save />}
            名前を付けて保存
          </Button>
        </form>
      </div>
      {!vault.user && (
        <div className="version-login">
          <Cloud size={19} />
          <span>
            Googleでログインすると、保存版を別のPCからも呼び出せます。
          </span>
          <Button
            variant="outline"
            disabled={busy || !vault.ready}
            onClick={() => void vault.login()}
          >
            Googleでログイン
          </Button>
        </div>
      )}
      {saved && (
        <output className="version-message">
          <Check size={16} />
          {saved}
        </output>
      )}
      <div className={`version-workspace ${selected ? 'with-preview' : ''}`}>
        <div className="version-list">
          {versions.filter((v) => v.kind === 'manual').map(item)}
          {!versions.some((v) => v.kind === 'manual') && (
            <p className="version-empty">
              名前付きの保存版はまだありません。
              <br />
              気に入った配置を、最初のバージョンとして残しましょう。
            </p>
          )}
          {versions.some((v) => v.kind === 'automatic') && (
            <details className="version-automatic">
              <summary>
                変更前の自動保存（
                {versions.filter((v) => v.kind === 'automatic').length}件）
              </summary>
              {versions.filter((v) => v.kind === 'automatic').map(item)}
            </details>
          )}
        </div>
        {selected && preview && (
          <div className="version-preview">
            <div className="version-preview-heading">
              <div>
                <span>保存版のプレビュー</span>
                <h3>{selected.name}</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="バージョンの比較を閉じる"
                onClick={() => setPreview(null)}
                disabled={busy}
              >
                <X />
              </Button>
            </div>
            {incompatible ? (
              <p className="version-message error">{incompatible}</p>
            ) : (
              <>
                <div className="version-diff-summary">
                  <GitCompareArrows size={16} />
                  <strong>
                    {differences.length
                      ? `${differences.length}キーに違いがあります`
                      : '現在の配置と同じです'}
                  </strong>
                  <span>色の付いたキーが変更箇所</span>
                </div>
                <div className="version-layers" aria-label="保存版のレイヤー">
                  {selected.config.layers.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-pressed={currentLayer === i}
                      disabled={busy}
                      onClick={() => {
                        setLayer(i);
                        setSelectedKey(null);
                      }}
                    >
                      L{i}
                      {differences.some((d) => d.layer === i) && <i />}
                    </button>
                  ))}
                </div>
                <KeyboardLayout
                  config={selected.config}
                  layer={currentLayer}
                  selected={selectedKey}
                  change={null}
                  disabled={busy}
                  highlighted={differences.map(
                    (d) => `${d.layer}:${d.row}:${d.col}`,
                  )}
                  onSelect={setSelectedKey}
                />
                {chosenDifference && (
                  <div className="version-key-diff">
                    選択したキー：
                    <strong>
                      {keyLabel(
                        chosenDifference.before,
                        selected.config.protocol,
                      )}
                    </strong>
                    <ArrowRight size={15} />
                    <strong>
                      {keyLabel(
                        chosenDifference.after,
                        selected.config.protocol,
                      )}
                    </strong>
                  </div>
                )}
                {differences.length > 0 && (
                  <details className="version-diff-list">
                    <summary>変更するキーを一覧で確認</summary>
                    {differences.map((d) => (
                      <div key={`${d.layer}:${d.row}:${d.col}`}>
                        <span>
                          L{d.layer} · 行{d.row} 列{d.col}
                        </span>
                        <strong>
                          {keyLabel(d.before, selected.config.protocol)}
                        </strong>
                        <ArrowRight size={12} />
                        <strong>
                          {keyLabel(d.after, selected.config.protocol)}
                        </strong>
                      </div>
                    ))}
                  </details>
                )}
                {stale && (
                  <p className="version-message">
                    比較後に現在の配置が変わりました。
                    <Button variant="ghost" onClick={() => choose(selected)}>
                      比較を更新
                    </Button>
                  </p>
                )}
                <div className="version-restore">
                  <p>
                    復元前の配置を自動保存します。
                    <br />
                    マクロ・コンボの内容は保存対象に含まれません。
                  </p>
                  <Button
                    disabled={
                      busy || !canRead || stale || differences.length === 0
                    }
                    onClick={() =>
                      void kb.restoreVersion(selected.config, preview.current)
                    }
                  >
                    <Archive />
                    {kb.config.mode === 'sample'
                      ? 'この保存版に戻す（サンプル）'
                      : 'この保存版をキーボードに適用'}
                  </Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <p className="version-footnote">
        保存版を選んだだけでは、キーボードの配置は変わりません。
      </p>
    </section>
  );
}
