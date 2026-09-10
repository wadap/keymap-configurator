'use client';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web app identifiers are public; access is enforced by Authentication and Rules.
const firebaseConfig = {
  apiKey: 'AIzaSyBopbEiQniq18opISMKZ7K_6v09NSmTpTQ',
  authDomain: 'keymap-configurator.firebaseapp.com',
  projectId: 'keymap-configurator',
  storageBucket: 'keymap-configurator.firebasestorage.app',
  messagingSenderId: '284001761113',
  appId: '1:284001761113:web:2dd05e5b1aade206ba7e48',
};

export function getFirebase() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return { auth: getAuth(app), db: getFirestore(app) };
}

export function firebaseError(error: unknown): string {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : '';
  if (
    code === 'auth/popup-closed-by-user' ||
    code === 'auth/cancelled-popup-request'
  )
    return 'ログインをキャンセルしました。';
  if (code === 'auth/popup-blocked')
    return 'ポップアップがブロックされています。許可してからもう一度ログインしてください。';
  if (code === 'auth/unauthorized-domain')
    return 'このURLはログイン許可ドメインに登録されていません。Firebase Authenticationの設定を確認してください。';
  if (
    code === 'auth/operation-not-allowed' ||
    code === 'auth/configuration-not-found'
  )
    return 'FirebaseでGoogleログインの有効化が必要です。';
  if (code === 'permission-denied')
    return 'クラウド保存へのアクセスが拒否されました。ログイン状態とFirestoreのルールを確認してください。';
  if (code === 'unavailable' || code === 'auth/network-request-failed')
    return 'クラウドに接続できません。通信状態を確認してください。';
  return error instanceof Error
    ? error.message
    : 'クラウド保存に失敗しました。';
}
