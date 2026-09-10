# 設計

- `KeymapVersion`: schemaVersion=1, id, name, createdAt(ISO), kind(manual/automatic), config(KeyboardConfig)。上書き・削除UIは作らない。
- `lib/keyboard/versions.ts`: 厳密なスナップショット検証、作成、差分、互換性、複数キーの復元。機器ID・protocol・行列・レイヤー数・物理アドレスの集合を照合する。
- `lib/keyboard/version-storage.ts`: アカウントごとにlocalStorageへ保存。破損や容量不足は書き込み開始前にエラーとする。既存Undo履歴と独立。
- `lib/firebase/client.ts`, `lib/firebase/versions.ts`: ブラウザ用Firebase設定と認証、Firestoreの保存/購読。`users/{uid}/versions/{versionId}`。配列の配列をFirestoreへ直接入れずconfigをJSON文字列として保存、読み出しで全フィールドを検証する。owner一致・createのみのRules、保存データのindex無効化。
- `components/versions/use-versions.ts`: Auth購読、ログイン/ログアウト、アカウント単位の一覧、ローカルの自動保存とクラウド同期。購読の解約とアカウント切替後の遅延応答を処理。
- `components/versions/version-panel.tsx`: 名前入力・保存一覧・全レイヤー差分・復元プレビュー。キーボード図は保存版のプレビューと差分強調を表示。保存一覧からの選択では実機に書かない。
- `use-keyboard.ts`: キー適用/Undo/保存版復元に共通の排他制御を使う。名前付き保存も新しく実機を読んだ値を保存する。復元前にプレビュー元と実機を照合し、バックアップ永続化→順次書き込み→全レイヤー読戻し照合。切断/不一致は停止しバックアップを保持。

復元で変更するセルは表示可能な通常キー・修飾キー・未割当・透過に限定する。高度なコードが変わる場合は理由を表示して停止し、未知の動作を送信しない。基本レイヤーのEnter/Esc/修飾キーを失う配置は停止する。

Firebase設定の提供をこの構成での実装承認として扱う。Analytics/Storage/課金設定は追加しない。バージョン保存タスクはFirebaseの設定・Rulesを反映する。ユーザーの追加依頼によるHosting公開は `.steering/20260910-firebase-hosting/` で管理する。
