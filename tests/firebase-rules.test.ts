import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sampleConfig } from '../lib/keyboard/sample';
import { createVersion } from '../lib/keyboard/versions';
import { decodeVersion, encodeVersion } from '../lib/firebase/version-codec';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

describe.skipIf(!process.env.FIRESTORE_EMULATOR_HOST)(
  'private immutable cloud versions',
  () => {
    let env: RulesTestEnvironment;
    beforeAll(async () => {
      env = await initializeTestEnvironment({
        projectId: 'demo-keymap-versions',
        firestore: { rules: readFileSync('firestore.rules', 'utf8') },
      });
    });
    afterAll(async () => {
      await env?.cleanup();
    });
    const payload = () => ({
      schemaVersion: 1,
      name: '普段用',
      kind: 'manual',
      createdAt: new Date().toISOString(),
      deviceId: 'sample:cornix-42',
      configJson: '{"test":true}',
      savedAt: serverTimestamp(),
    });

    it('allows an owner to create and list a saved version', async () => {
      const db = env.authenticatedContext('alice').firestore();
      await assertSucceeds(
        setDoc(doc(db, 'users/alice/versions/first'), payload()),
      );
      await assertSucceeds(getDocs(collection(db, 'users/alice/versions')));
    });
    it('round-trips all layers and unknown keycodes through Firestore', async () => {
      const config = sampleConfig();
      config.layers[1][0] = 0xffff;
      const version = createVersion(config, '全レイヤーを保存', 'manual');
      const ref = doc(
        env.authenticatedContext('roundtrip').firestore(),
        'users',
        'roundtrip',
        'versions',
        version.id,
      );
      await setDoc(ref, {
        ...encodeVersion(version),
        savedAt: serverTimestamp(),
      });
      const saved = await getDoc(ref);
      expect(decodeVersion(saved.id, saved.data())).toEqual(version);
    });
    it('rejects anonymous and other-user access', async () => {
      const anonymous = env.unauthenticatedContext().firestore();
      const bob = env.authenticatedContext('bob').firestore();
      await assertFails(
        setDoc(doc(anonymous, 'users/alice/versions/anonymous'), payload()),
      );
      await assertFails(
        setDoc(doc(bob, 'users/alice/versions/foreign'), payload()),
      );
      await assertFails(getDoc(doc(bob, 'users/alice/versions/first')));
      await assertFails(getDocs(collection(bob, 'users/alice/versions')));
    });
    it('rejects overwriting a saved version even by its owner', async () => {
      const ref = doc(
        env.authenticatedContext('alice').firestore(),
        'users/alice/versions/immutable',
      );
      await assertSucceeds(setDoc(ref, payload()));
      await assertFails(updateDoc(ref, { name: 'overwritten' }));
      await assertFails(setDoc(ref, payload()));
    });
    it('rejects malformed, oversized, extra-field and forged-time documents', async () => {
      const db = env.authenticatedContext('alice').firestore();
      for (const [index, invalid] of [
        { ...payload(), name: '' },
        { ...payload(), configJson: [] },
        { ...payload(), configJson: 'x'.repeat(400001) },
        { ...payload(), kind: 'public' },
        { ...payload(), public: true },
        { ...payload(), savedAt: new Date(0) },
      ].entries())
        await assertFails(
          setDoc(doc(db, `users/alice/versions/invalid-${index}`), invalid),
        );
    });
  },
);
