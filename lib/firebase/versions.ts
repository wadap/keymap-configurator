'use client';
import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getFirebase } from './client';
import { decodeVersion, encodeVersion } from './version-codec';
import type { KeymapVersion } from '../keyboard/versions';

export function subscribeCloudVersions(
  uid: string,
  next: (versions: KeymapVersion[]) => void,
  failed: (error: unknown) => void,
) {
  const { db } = getFirebase();
  return onSnapshot(
    collection(db, 'users', uid, 'versions'),
    { includeMetadataChanges: true },
    (snapshot) => {
      try {
        next(
          snapshot.docs
            .filter((d) => !d.metadata.hasPendingWrites)
            .map((d) => decodeVersion(d.id, d.data())),
        );
      } catch (error) {
        failed(error);
      }
    },
    failed,
  );
}

export async function saveCloudVersion(uid: string, version: KeymapVersion) {
  const { auth, db } = getFirebase();
  if (auth.currentUser?.uid !== uid)
    throw Error(
      'ログイン中のアカウントが変わりました。もう一度操作してください。',
    );
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      setDoc(doc(db, 'users', uid, 'versions', version.id), {
        ...encodeVersion(version),
        savedAt: serverTimestamp(),
      }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              Error(
                'クラウド保存の完了を確認できませんでした。ブラウザ内には保存済みです。通信が戻ると同期される場合があります。',
              ),
            ),
          15000,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
  if (auth.currentUser?.uid !== uid)
    throw Error(
      'ログイン中のアカウントが変わりました。もう一度操作してください。',
    );
}
