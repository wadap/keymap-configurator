'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CircleHelp,
  Download,
  Keyboard,
  Layers,
  LoaderCircle,
  LockKeyhole,
  MousePointer2,
  Plug,
  RotateCcw,
  ShieldCheck,
  Unplug,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KeyboardLayout } from '@/components/keyboard/keyboard-layout';
import { useKeyboard } from '@/components/keyboard/use-keyboard';
import { useVersions } from '@/components/versions/use-versions';
import { VersionPanel } from '@/components/versions/version-panel';
import {
  hexCode,
  isEditable,
  keyLabel,
  keyName,
  keyOptions,
  validateChange,
} from '@/lib/keyboard/keycodes';
import type { KeyChange, PhysicalKey, Snapshot } from '@/lib/keyboard/types';

const categories = ['文字', '数字・記号', '操作', '修飾キー', '機能'];
const layerNames = ['基本', '記号・数字', '移動・機能', 'カスタム'];

function downloadSnapshot(snapshot: Snapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `keymap-${snapshot.createdAt.replace(/[:.]/g, '-')}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const vault = useVersions();
  const kb = useKeyboard(vault.checkpoint);
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link className="wordmark" href="/" aria-label="Cornix Keymap ホーム">
          <span className="brand-icon">
            <Keyboard size={23} />
          </span>
          <span>
            Cornix<span className="wordmark-sub"> / keymap</span>
          </span>
        </Link>
        <div className="header-actions">
          <Button
            variant="ghost"
            disabled={!vault.ready || vault.busy || Boolean(kb.busy)}
            onClick={() => void (vault.user ? vault.logout() : vault.login())}
          >
            {vault.user
              ? `${vault.user.displayName ?? 'アカウント'} · ログアウト`
              : 'Googleでログイン'}
          </Button>
          <span className={`connection-state ${kb.connected ? 'online' : ''}`}>
            <i />
            {kb.connected
              ? 'USB 接続中'
              : kb.config.mode === 'sample'
                ? 'サンプル'
                : '未接続'}
          </span>
          <Button
            className="connect-button"
            disabled={Boolean(kb.busy) || (!kb.connected && !kb.supported)}
            onClick={() => void (kb.connected ? kb.disconnect() : kb.connect())}
          >
            {kb.busy ? (
              <LoaderCircle className="spin" />
            ) : kb.connected ? (
              <Unplug />
            ) : (
              <Plug />
            )}
            {kb.connected ? '接続を解除' : 'キーボードを接続'}
          </Button>
        </div>
      </header>
      <main>
        <div className="page-heading">
          <div>
            <div className="breadcrumb">
              ワークスペース <ChevronRight size={13} /> キーマップ
            </div>
            <h1>
              いつものキーを、
              <br className="mobile-break" />
              自分の配置に。
            </h1>
            <p>キーを選んで割り当てを変更。差分を確認してから適用できます。</p>
          </div>
          <span className="version-label">
            最小版 <span>v0.1</span>
          </span>
        </div>
        {!kb.supported && (
          <output className="message warning">
            <CircleHelp size={18} />
            <span>
              実機への接続はChrome /
              Edgeでこのページを開いてください。サンプルの編集はここで試せます。
            </span>
          </output>
        )}
        {kb.error && (
          <div className="message error" role="alert">
            <CircleHelp size={18} />
            <span>{kb.error}</span>
          </div>
        )}
        {(kb.busy || kb.notice) && (
          <output className="message">
            {kb.busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <Check size={18} />
            )}
            <span>{kb.busy || kb.notice}</span>
          </output>
        )}
        <Editor key={`${kb.config.id}:${kb.revision}`} kb={kb} />
        <VersionPanel kb={kb} vault={vault} />
        <footer className="page-footer">
          <span>
            <ShieldCheck size={15} />
            {vault.user
              ? '保存版は自分のアカウントに同期。復旧用の履歴はこのブラウザにも残します。'
              : '変更前の配置はこのブラウザに保存。ログインすると保存版をクラウドに残せます。'}
          </span>
          <span>
            Chrome / Edge <span className="footer-dot">·</span> USB / Vial
          </span>
        </footer>
      </main>
    </div>
  );
}

function Editor({ kb }: { kb: ReturnType<typeof useKeyboard> }) {
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<PhysicalKey | null>(null);
  const [candidate, setCandidate] = useState<number | null>(null);
  const [category, setCategory] = useState('文字');
  const config = kb.config,
    sample = config.mode === 'sample';
  const code = selected
    ? config.layers[layer][selected.row * config.cols + selected.col]
    : null;
  const change: KeyChange | null =
    selected && code !== null && candidate !== null && candidate !== code
      ? {
          layer,
          row: selected.row,
          col: selected.col,
          before: code,
          after: candidate,
        }
      : null;
  let validation = '';
  if (change) {
    try {
      validateChange(config, change);
    } catch (e) {
      validation =
        e instanceof Error ? e.message : 'この変更は適用できません。';
    }
  }
  const canEdit = sample || kb.connected,
    pending = Boolean(kb.busy);
  const latest = kb.history.find((s) => s.status !== 'restored');
  const chooseKey = (key: PhysicalKey) => {
    setSelected(key);
    setCandidate(null);
  };

  return (
    <>
      <div className="workbench">
        <section className="keyboard-panel" aria-label="キーマップ">
          <div className="device-heading">
            <div className="device-name">
              <Keyboard size={22} />
              <h2>{config.name}</h2>
              <span className="device-tag">
                {sample ? 'サンプル配列' : `Vial protocol ${config.protocol}`}
              </span>
            </div>
            <span className="key-count">{config.keys.length} keys</span>
          </div>
          <div className="sample-banner">
            {sample ? (
              <>
                <span className="sample-dot" />
                <span>
                  サンプルで操作を試せます。実際の設定は、接続後に読み込みます。
                </span>
              </>
            ) : (
              <>
                <span
                  className={`sample-dot ${kb.connected ? 'live-dot' : ''}`}
                />
                <span>
                  {kb.connected
                    ? '機器から読み込んだキーマップです。'
                    : '接続が切れています。再接続すると編集できます。'}
                </span>
                {!kb.connected && (
                  <button onClick={kb.useSample}>サンプルに戻る</button>
                )}
              </>
            )}
          </div>
          <Tabs
            value={layer}
            onValueChange={(value) => {
              setLayer(Number(value));
              setSelected(null);
              setCandidate(null);
            }}
          >
            <div className="layer-bar">
              <span>
                <Layers size={16} />
                レイヤー
              </span>
              <TabsList
                className="layer-tabs"
                aria-label="キーボードのレイヤー"
              >
                {config.layers.map((_, i) => (
                  <TabsTrigger key={i} value={i} disabled={pending}>
                    L{i}
                  </TabsTrigger>
                ))}
              </TabsList>
              <span className="layer-total">{config.layers.length} layers</span>
            </div>
            {config.layers.map((_, i) => (
              <TabsContent key={i} value={i} className="layer-content">
                <div className="layer-caption">
                  <span>
                    Layer {i}
                    <strong>
                      {sample ? layerNames[i] : i === 0 ? '基本レイヤー' : ''}
                    </strong>
                  </span>
                  <span>
                    {change
                      ? '青い点は適用前の変更'
                      : '変更したいキーをクリック'}
                  </span>
                </div>
                <KeyboardLayout
                  config={config}
                  layer={i}
                  selected={selected}
                  change={change}
                  disabled={pending}
                  onSelect={chooseKey}
                />
              </TabsContent>
            ))}
          </Tabs>
          {config.layoutWarning && (
            <p className="layout-warning">{config.layoutWarning}</p>
          )}
          <div className="keyboard-legend">
            <span>
              <i className="legend-square" />
              通常キー
            </span>
            <span>
              <i className="legend-square dark" />
              高度な割り当て
            </span>
            <span>
              <i className="legend-square blue" />
              選択中
            </span>
            <span className="legend-hint">
              <MousePointer2 size={14} />
              キーを選んで編集
            </span>
          </div>
          <div className="panel-bottom">
            <LockKeyhole size={16} />
            <span>「適用」を押すまで、キーボードは変わりません。</span>
            {!sample && (
              <Button
                variant="ghost"
                disabled={pending || !kb.connected}
                onClick={() => void kb.refresh()}
              >
                <RotateCcw />
                再読み込み
              </Button>
            )}
          </div>
        </section>

        <aside className="editor-panel" aria-label="キーの編集">
          <div className="editor-heading">
            <h2>キーの割り当て</h2>
            <span>
              {selected
                ? `L${layer} / ${selected.row},${selected.col}`
                : '1キーずつ編集'}
            </span>
          </div>
          {!selected || code === null ? (
            <div className="editor-empty">
              <div className="empty-key">
                <MousePointer2 size={30} />
              </div>
              <h3>どのキーを変えますか？</h3>
              <p>
                左のキーボードからキーを選ぶと、
                <br />
                ここで割り当てを変更できます。
              </p>
              <button
                className="try-link"
                onClick={() => {
                  const target =
                    config.keys.find(
                      (k) =>
                        config.layers[0][k.row * config.cols + k.col] === 57,
                    ) ?? config.keys[0];
                  setLayer(0);
                  chooseKey(target);
                  setCategory('操作');
                }}
              >
                まずは1キー選んでみる <ArrowRight size={15} />
              </button>
            </div>
          ) : (
            <>
              <div className="selected-key-summary">
                <span className="large-key">
                  {keyLabel(code, config.protocol)}
                </span>
                <div>
                  <span className="small-label">現在の割り当て</span>
                  <strong>{keyName(code, config.protocol)}</strong>
                  <span className="coordinate">
                    行 {selected.row} / 列 {selected.col}{' '}
                    <span>{hexCode(code)}</span>
                  </span>
                </div>
              </div>
              {!isEditable(code) ? (
                <div className="protected-key">
                  <LockKeyhole size={22} />
                  <h3>この割り当ては読み取り専用です</h3>
                  <p>
                    レイヤー切替やマクロなどは、そのまま保持します。最初の版では通常キーと修飾キーを編集できます。
                  </p>
                </div>
              ) : (
                <div className="key-picker">
                  <p className="picker-title">新しい割り当て</p>
                  <Tabs
                    value={category}
                    onValueChange={(value) => setCategory(String(value))}
                  >
                    <TabsList
                      className="category-tabs"
                      aria-label="割り当ての種類"
                    >
                      {categories.map((c) => (
                        <TabsTrigger key={c} value={c}>
                          {c}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {categories.map((c) => (
                      <TabsContent key={c} value={c}>
                        <div className="key-options">
                          {keyOptions
                            .filter((k) => k.group === c)
                            .map((k) => (
                              <button
                                key={k.code}
                                className={`key-option ${candidate === k.code ? 'chosen' : ''}`}
                                disabled={pending || !canEdit}
                                aria-pressed={candidate === k.code}
                                title={k.name}
                                onClick={() => setCandidate(k.code)}
                              >
                                {k.label}
                              </button>
                            ))}
                        </div>
                      </TabsContent>
                    ))}
                  </Tabs>
                  {category === '修飾キー' && (
                    <p className="picker-note">
                      Gui はMacのCommand / Windowsキーです。
                    </p>
                  )}
                </div>
              )}
            </>
          )}
          <div className={`diff-panel ${change ? 'has-change' : ''}`}>
            <div className="diff-heading">
              <span>変更プレビュー</span>
              <span>{change ? '1件' : '変更なし'}</span>
            </div>
            {change ? (
              <>
                <div className="diff-values">
                  <div>
                    <span>変更前</span>
                    <strong>{keyLabel(change.before, config.protocol)}</strong>
                  </div>
                  <ArrowRight size={20} />
                  <div className="diff-after">
                    <span>変更後</span>
                    <strong>{keyLabel(change.after, config.protocol)}</strong>
                  </div>
                </div>
                <p className="diff-location">
                  Layer {layer} / 行 {change.row} / 列 {change.col}
                </p>
                {validation && (
                  <p className="validation-error" role="alert">
                    {validation}
                  </p>
                )}
                <Button
                  className="apply-button"
                  disabled={pending || !canEdit || Boolean(validation)}
                  onClick={() => void kb.apply(change)}
                >
                  {pending ? <LoaderCircle className="spin" /> : <Check />}
                  {sample ? 'サンプルに適用' : 'キーボードに適用'}
                </Button>
                <Button
                  variant="ghost"
                  className="cancel-change"
                  disabled={pending}
                  onClick={() => setCandidate(null)}
                >
                  <X />
                  変更を取り消す
                </Button>
                <p className="snapshot-note">
                  <ShieldCheck size={13} />
                  変更前のキーマップを自動保存します
                </p>
              </>
            ) : (
              <p className="no-diff">
                割り当てを選ぶと、ここに差分が表示されます。
              </p>
            )}
          </div>
        </aside>
      </div>

      <section className="history-section" aria-label="変更履歴">
        <div className="history-heading">
          <div>
            <h2>
              <RotateCcw size={18} />
              変更履歴
            </h2>
            <p>適用前のキーマップを保存。直近の変更から順番に戻せます。</p>
          </div>
          <span>{sample ? 'サンプルの履歴' : 'このキーボードの履歴'}</span>
        </div>
        {!kb.history.length ? (
          <div className="history-empty">
            <span className="history-empty-icon">
              <RotateCcw size={21} />
            </span>
            <div>
              <strong>まだ変更はありません</strong>
              <p>最初の変更を適用すると、ここに履歴が残ります。</p>
            </div>
            <span className="history-empty-end">いつでも、ひとつ前へ。</span>
          </div>
        ) : (
          <div className="history-list">
            {kb.history.map((s) => (
              <div key={s.id} className="history-row">
                <span
                  className={`history-status ${s.status === 'restored' ? 'restored' : ''}`}
                >
                  {s.status === 'restored' ? (
                    <RotateCcw size={17} />
                  ) : s.status === 'applied' ? (
                    <Check size={17} />
                  ) : (
                    <CircleHelp size={17} />
                  )}
                </span>
                <div className="history-change">
                  <strong>
                    {keyLabel(s.change.before, s.before.protocol)}{' '}
                    <ArrowRight size={14} />{' '}
                    {keyLabel(s.change.after, s.before.protocol)}
                  </strong>
                  <span>
                    Layer {s.change.layer} / 行 {s.change.row} / 列{' '}
                    {s.change.col}
                  </span>
                </div>
                <time dateTime={s.createdAt}>
                  {new Date(s.createdAt).toLocaleString('ja-JP', {
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
                <span className="history-status-label">
                  {s.status === 'applied'
                    ? '適用済み'
                    : s.status === 'restored'
                      ? '復元済み'
                      : '結果を要確認'}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="この履歴のキーマップをJSONで保存"
                  onClick={() => downloadSnapshot(s)}
                >
                  <Download />
                </Button>
                <Button
                  variant="outline"
                  disabled={
                    pending ||
                    !canEdit ||
                    latest?.id !== s.id ||
                    s.status === 'restored'
                  }
                  onClick={() => void kb.undo(s)}
                >
                  <RotateCcw />
                  元に戻す
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="scope-note">
        <CircleHelp size={16} />
        <p>
          最初は、確実な1キーの変更から。AI相談やマクロ・コンボの編集は、次のステップで追加します。
        </p>
      </div>
    </>
  );
}
