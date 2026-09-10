# Version snapshots Implementation Plan

Goal: Firebase認証と名前付き保存・差分プレビュー・復元・適用前の自動保存。
Architecture: 既存WebHID層を維持し、テスト可能な保存版ドメイン、Firebaseアダプタ、UIに分離する。
Tech Stack: React/TypeScript/Vinext, Firebase Authentication/Firestore, Vitest/Firestore Emulator。
Spec: requirements.md / design.md

- [x] Task 1: `lib/keyboard/versions.ts`, `version-storage.ts`, `tests/versions.test.ts` に保存/検証/差分/復元と境界テスト。API: createVersion(config,name,kind), parseVersion(unknown), diffVersion(current,target), restoreVersion(current,target,io)。VersionIOはread/write/backup(config):Promise<void>。書込前のbackup失敗、途中切断、古いpreview、未知コード、他機器の拒否を試験する。
- [x] Task 2: Firebase SDK・Rules・認証とversionsアダプタ。Rules emulatorで他人/未認証/上書き/不正形式を拒否し本人の追記/読取りだけ成功させる。ユーザー指定プロジェクトの設定と既存Rulesを確認してから必要な設定を反映する。
- [x] Task 3: 保存一覧/比較UIとuseKeyboardへの排他制御統合。全ての実機書込み前に自動保存、名前付き保存は実機再読込み、cloud未接続を正確に表示する。現行サンプルとUSB切断時の操作を確認する。
- [x] Task 4: 26件の既存テスト＋新規テスト、型検査、lint、ビルド、ブラウザ確認、独立レビュー、記録更新。

工程ごとにテスト失敗→実装→成功を確認。サブエージェントは独立するドメイン実装とレビューに使用し、FirebaseとUIの統合は主担当で行う。現在の専用ローカルブランチ `feat/version-snapshots` で、ユーザーのlocalhostへ反映する。

検証記録: ChromeでGoogleログイン、名前付き保存、クラウドACK表示、再読み込み後の取得、変更前の自動保存、差分プレビュー、保存版復元を確認。サンプルで複数レイヤー復元と再読み込み後の保持を確認。実機書込みは行っていない。Firestoreエミュレータを含めた68テスト（9ファイル）、型検査、lint、ビルドが成功。

独立レビューの指摘（保護キーの書込順序、実機メタデータ再取得、初期サンプル永続化）を1e2c5cdで修正。再レビューで見つかった同期探索の負荷を617b91dで制限し、再確認PASS・残存指摘0件。23キーの問題ケースは500ms未満でI/O前に停止。最終作業はローカルブランチに記録し、Firebase Hostingの公開は追加タスクで実行する。
