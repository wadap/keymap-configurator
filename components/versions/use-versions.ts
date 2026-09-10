'use client';
import { useEffect, useRef, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import { firebaseError, getFirebase } from '@/lib/firebase/client';
import {
  saveCloudVersion,
  subscribeCloudVersions,
} from '@/lib/firebase/versions';
import { createVersion, type KeymapVersion } from '@/lib/keyboard/versions';
import { readVersions, saveVersionLocal } from '@/lib/keyboard/version-storage';
import type { KeyboardConfig } from '@/lib/keyboard/types';

type VersionState = {
  owner: string;
  local: KeymapVersion[];
  remote: KeymapVersion[];
  error: string;
};
export function useVersions() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<VersionState>({
    owner: 'local',
    local: [],
    remote: [],
    error: '',
  });
  const ownerRef = useRef('local');

  useEffect(() => {
    let disposed = false;
    let stopVersions: (() => void) | undefined;
    const { auth } = getFirebase();
    const stopAuth = onAuthStateChanged(
      auth,
      (account) => {
        stopVersions?.();
        const owner = account?.uid ?? 'local';
        ownerRef.current = owner;
        setUser(account);
        setReady(true);
        let local: KeymapVersion[] = [],
          error = '';
        try {
          local = readVersions(owner);
        } catch (e) {
          error = firebaseError(e);
        }
        setState({ owner, local, remote: [], error });
        if (account)
          stopVersions = subscribeCloudVersions(
            account.uid,
            (remote) => {
              if (!disposed && ownerRef.current === owner)
                setState((old) =>
                  old.owner === owner ? { ...old, remote } : old,
                );
            },
            (e) => {
              if (!disposed && ownerRef.current === owner)
                setState((old) => ({ ...old, error: firebaseError(e) }));
            },
          );
      },
      (e) => {
        setReady(true);
        setState((old) => ({ ...old, error: firebaseError(e) }));
      },
    );
    return () => {
      disposed = true;
      stopAuth();
      stopVersions?.();
    };
  }, []);

  async function login() {
    setBusy(true);
    setState((old) => ({ ...old, error: '' }));
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(getFirebase().auth, provider);
    } catch (e) {
      setState((old) => ({ ...old, error: firebaseError(e) }));
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await signOut(getFirebase().auth);
    } catch (e) {
      setState((old) => ({ ...old, error: firebaseError(e) }));
    } finally {
      setBusy(false);
    }
  }
  async function save(
    config: KeyboardConfig,
    name: string,
    kind: 'manual' | 'automatic' = 'manual',
  ) {
    if (!ready)
      throw Error(
        'ログイン状態を確認しています。少し待ってから操作してください。',
      );
    const owner = user?.uid ?? 'local';
    if (ownerRef.current !== owner)
      throw Error('アカウントが変わりました。もう一度操作してください。');
    const version = createVersion(config, name, kind);
    saveVersionLocal(version, owner);
    const local = readVersions(owner);
    setState((old) =>
      old.owner === owner ? { ...old, local, error: '' } : old,
    );
    if (user) {
      try {
        await saveCloudVersion(user.uid, version);
      } catch (e) {
        throw Error(firebaseError(e));
      }
    }
    if (ownerRef.current !== owner)
      throw Error(
        '保存中にアカウントが変わりました。実機への書き込みを停止しました。',
      );
    if (user)
      setState((old) =>
        old.owner === owner
          ? {
              ...old,
              remote: [
                version,
                ...old.remote.filter((v) => v.id !== version.id),
              ],
            }
          : old,
      );
    return version;
  }

  const owner = user?.uid ?? 'local';
  const active =
    state.owner === owner ? state : { local: [], remote: [], error: '' };
  const cloudIds = new Set(active.remote.map((v) => v.id));
  const versions = Array.from(
    new Map([...active.local, ...active.remote].map((v) => [v.id, v])).values(),
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return {
    user,
    ready,
    busy,
    error: active.error,
    versions,
    cloudIds,
    login,
    logout,
    save,
    checkpoint: (config: KeyboardConfig) =>
      save(
        config,
        `変更前 ${new Date().toLocaleString('ja-JP')}`,
        'automatic',
      ).then(() => {}),
  };
}
