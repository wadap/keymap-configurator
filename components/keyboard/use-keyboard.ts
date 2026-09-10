'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDeviceIO } from '@/lib/keyboard/device-io';
import { readHistory, saveSnapshot } from '@/lib/keyboard/history';
import { sampleConfig } from '@/lib/keyboard/sample';
import {
  createSampleTransactionIO,
  loadSampleState,
} from '@/lib/keyboard/sample-state';
import { HidTransport, requestKeyboard } from '@/lib/keyboard/transport';
import { VialClient } from '@/lib/keyboard/vial';
import { restoreVersion } from '@/lib/keyboard/versions';
import { applyChange, restoreSnapshot } from '@/lib/keyboard/transactions';
import type {
  KeyboardConfig,
  KeyChange,
  Snapshot,
  TransactionIO,
} from '@/lib/keyboard/types';

export function useKeyboard(
  checkpoint: (config: KeyboardConfig) => Promise<void>,
) {
  const [config, setConfig] = useState(sampleConfig);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [busy, setBusy] = useState('');
  const [connected, setConnected] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const transport = useRef<HidTransport | null>(null);
  const client = useRef<VialClient | null>(null);
  const sample = useRef(sampleConfig());
  const locked = useRef(false);
  const reloadHistory = useCallback(() => {
    const saved = readHistory();
    setHistory(saved);
    return saved;
  }, []);

  useEffect(() => {
    // Browser capability and persistent history are external state unavailable during SSR.
    // eslint-disable-next-line react/react-compiler
    setSupported('hid' in navigator && window.isSecureContext);
    try {
      reloadHistory();
      const workspace = loadSampleState();
      sample.current = workspace;
      setConfig(workspace);
    } catch (e) {
      setError(e instanceof Error ? e.message : '履歴を読み込めません。');
    }
    const onDisconnect = (event: HIDConnectionEvent) => {
      if (event.device !== transport.current?.device) return;
      void transport.current.close();
      transport.current = null;
      client.current = null;
      setConnected(false);
      setNotice('');
      setError(
        'USB接続が切れました。再接続すると、保存済みの履歴から復元できます。',
      );
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (locked.current) event.preventDefault();
    };
    navigator.hid?.addEventListener('disconnect', onDisconnect);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      navigator.hid?.removeEventListener('disconnect', onDisconnect);
      window.removeEventListener('beforeunload', onBeforeUnload);
      void transport.current?.close();
    };
  }, [reloadHistory]);

  const disconnect = async () => {
    if (locked.current) return;
    await transport.current?.close();
    transport.current = null;
    client.current = null;
    setConnected(false);
    setNotice('接続を解除しました。表示中の設定は読み取り専用です。');
  };
  const connect = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy('接続するキーボードを選んでください…');
    setError('');
    setNotice('');
    let next: HidTransport | null = null;
    try {
      next = await requestKeyboard();
      if (!next) return;
      const nextClient = new VialClient(next);
      const loaded = await nextClient.load(next.device, setBusy);
      transport.current = next;
      client.current = nextClient;
      setConfig(loaded);
      setConnected(true);
      setRevision((r) => r + 1);
      reloadHistory();
      setNotice(
        'キーマップを読み込みました。変更は「キーボードに適用」を押すまで反映されません。',
      );
    } catch (e) {
      await next?.close();
      transport.current = null;
      client.current = null;
      setConnected(false);
      setError(
        e instanceof Error
          ? e.message
          : '接続できません。Vialなど他の設定アプリを閉じて再接続してください。',
      );
    } finally {
      locked.current = false;
      setBusy('');
    }
  };
  const useSample = () => {
    if (locked.current || connected) return;
    setConfig(sample.current);
    setRevision((r) => r + 1);
    setError('');
    setNotice('サンプルを表示しています。実機への書き込みは行いません。');
  };
  function io(automaticBackup = true): TransactionIO {
    if (config.mode === 'sample') {
      const sampleIO = createSampleTransactionIO({
        checkpoint,
        automaticBackup,
        onChange: (next) => {
          sample.current = next;
        },
      });
      return {
        ...sampleIO,
        save: (snapshot) => {
          sampleIO.save(snapshot);
          reloadHistory();
        },
      };
    }

    const activeTransport = transport.current;
    const activeClient = client.current;
    if (!connected || !activeTransport || !activeClient)
      throw Error('キーボードを接続してください。');
    const deviceIO = createDeviceIO(
      activeClient,
      activeTransport.device,
      () =>
        transport.current === activeTransport &&
        client.current === activeClient,
      automaticBackup ? checkpoint : undefined,
    );
    return {
      read: deviceIO.read,
      write: deviceIO.write,
      save: (snapshot) => {
        saveSnapshot(snapshot);
        reloadHistory();
      },
    };
  }
  async function run(
    label: string,
    task: () => Promise<{ config: KeyboardConfig }>,
    success?: string,
  ) {
    if (locked.current) return false;
    locked.current = true;
    setBusy(label);
    setError('');
    setNotice('');
    try {
      const result = await task();
      setConfig(result.config);
      setRevision((r) => r + 1);
      setNotice(
        success ??
          (label.startsWith('復元')
            ? '元の割り当てに戻しました。'
            : label.startsWith('キーマップ')
              ? '現在のキーマップを読み込みました。'
              : '適用後の割り当てを再読み込みし、一致を確認しました。'),
      );
      return true;
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : '操作に失敗しました。再接続してください。',
      );
      if (config.mode === 'device') {
        await transport.current?.close();
        transport.current = null;
        client.current = null;
        setConnected(false);
      }
      return false;
    } finally {
      try {
        reloadHistory();
      } catch {
        /* Preserve the original persistence error. */
      }
      locked.current = false;
      setBusy('');
    }
  }
  return {
    config,
    history: history.filter(
      (s) => s.before.id === config.id && s.before.mode === config.mode,
    ),
    busy,
    connected,
    supported,
    error,
    notice,
    revision,
    connect,
    disconnect,
    useSample,
    captureVersion: (save: (config: KeyboardConfig) => Promise<unknown>) =>
      run(
        '現在のキーマップを保存しています…',
        async () => {
          const fresh = await io().read();
          await save(fresh);
          return { config: fresh };
        },
        'バージョンを保存しました。',
      ),
    restoreVersion: (target: KeyboardConfig, preview: KeyboardConfig) =>
      run(
        '復元しています…',
        async () => {
          const currentIO = io(false);
          return restoreVersion(preview, target, {
            read: () => currentIO.read(),
            write: (current, change) => currentIO.write(current, change),
            backup: checkpoint,
          });
        },
        '保存版の配置に戻し、全レイヤーの一致を確認しました。',
      ),
    apply: (change: KeyChange) =>
      run('変更を保存して適用しています…', () =>
        applyChange(config, change, io()),
      ),
    undo: (snapshot: Snapshot) =>
      run('復元しています…', () => restoreSnapshot(snapshot, io())),
    refresh: () =>
      run('キーマップを再読み込みしています…', async () => {
        if (config.mode === 'sample') return { config: await io().read() };
        if (!connected || !transport.current)
          throw Error('キーボードを接続してください。');
        // Refresh geometry as well as keycodes; firmware can change the layout definition.
        const nextClient = new VialClient(transport.current);
        const loaded = await nextClient.load(transport.current.device, setBusy);
        client.current = nextClient;
        return { config: loaded };
      }),
  };
}
