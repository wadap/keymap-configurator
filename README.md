# Cornix / Keymap

Vial対応キーボードの配置をブラウザから読み取り、編集・バージョン保存・復元する最小版です。日本語UI。CornixLPの物理配置表示に対応しています。

[アプリを開く](https://keymap-configurator.web.app) · [GitHub](https://github.com/wadap/keymap-configurator)

## 起動

Node.js 22.13以上（24推奨）。

```sh
npm ci
npm run dev
```

表示されたlocalhostのURLをChrome / Edgeで開きます。USB接続にはHTTPSまたはlocalhostとWebHIDが必要です。アプリ内ブラウザで接続できない場合はURLをChromeへコピーしてください。

## できること

- USB / WebHIDでVialのRaw HIDインターフェースを選択。
- デバイスのXZ圧縮定義と全レイヤーを読取。分割・回転のあるKLEレイアウトを描画。
- 通常キー、数字、記号、F1〜F12、修飾キーの1キー編集。
- 変更前後を表示し、明示的な適用で書き込み。
- 変更前の全キーマップをブラウザに保存し、書込後に全レイヤーを再読込して照合。
- 履歴から直近の変更をUndo。再接続後も同じブラウザ・同じURLで履歴を利用可能。
- Googleでログインし、全レイヤーの配置に名前を付けてFirestoreへ保存。保存版を選ぶと差分をキー位置とレイヤーごとに確認できます。
- 保存版への復元前にも現在の配置を自動保存。ログイン中はクラウド保存の完了を待ってから書き込みます。未ログイン時はブラウザ内へ自動保存します。
- 実機に触れず編集・適用・Undoを試せる42キーのサンプル（Cornixの工場出荷設定ではありません）。

## 制約

- 実装はVIA protocol 9 / Vial protocol 0〜6を対象。CornixLP実機で50キー・10レイヤーの読取と物理配置表示を確認済みです。**実機への書込み・保存版復元の受入試験は未実施**です。
- WebHIDで公開されるVID/PIDとVial firmware UIDを照合します。Vial UIDは個体ごとのシリアル番号ではないため、同型・同ファームウェアの別個体の識別は保証しません。適用とUndoでは全キーマップも照合します。
- レイヤー切替（MO/LM/LT等）、Mod-Tap、マクロなどの高度な割当は16bit値を保存・保持し、読み取り専用です。保存版との差分に高度な割当が含まれる場合も、書込みを開始せず停止します。未解析のコードは16進数で表示。
- 複数の物理レイアウト選択肢がある定義は、誤った位置を示さないよう行列で表示します。エンコーダ回転は編集しません。
- 唯一の基本レイヤーのEnter / Esc / 修飾キーを変更すると停止。保存版への復元も、途中の配置でこれらのキーを失わない順序を事前に確認します。安全な順序が作れない入れ替えでは、先に同じ役割を別キーへ追加してください。レイヤー到達性の完全な解析は次段階です。
- Macro / Combo / Tap Danceの内容やQMK設定は取得・保存していません。履歴は**全設定バックアップではなくキーマップのスナップショット**です。
- 1キー変更の履歴と自動保存のローカルコピーはlocalStorageに保存。同じURL・ブラウザでのみ使用でき、サイトデータ削除で失われます。クラウド保存版はログインした本人だけが参照でき、上書き・削除はできません。未ログイン時の自動保存はログイン後に自動移行しません。
- 通信失敗時はローカル保存を残し、実機への書込みを止めます。容量不足時も保存版を自動削除せず停止します。書込み途中の切断では自動で巻き戻さず、再接続後に自動保存版を選んで差分を確認します。
- JSON書出しはこのアプリ固有の参考・復旧用データで、Vialへのインポート形式ではありません。この版にはJSONインポート機能はありません。
- キーの記号はUS配列のUSB HIDコード名。実際の出力はOSの入力言語・配列設定に依存します。
- AIチャット、構造化AI提案、レイヤーアクションの編集は次段階です。

## 最初の実機確認

1. Vialで現在の設定を別途バックアップし、Vialなど他の設定アプリを閉じる。
2. CornixをUSB接続。Chrome / Edgeで「キーボードを接続」を押し、対象デバイスを選択。
3. 読み込まれたレイヤー数、物理キー位置、現在のキー割当をVialで確認した内容と照合する。
4. 使用頻度の低い通常キーを1つ選び、別の通常キーへ変更。差分を確認して「キーボードに適用」。
5. テキストエディターで変更が反映されたことを確認。
6. 履歴の「元に戻す」を押し、元の入力に戻ることを確認。
7. もう一度1キーを変更し、ページを再読込・再接続して、履歴から元に戻せることを確認。

切断・応答待ちタイムアウトでは接続を無効にし、同じ接続で自動再試行しません。履歴に「結果を要確認」と出た場合、再接続して最新履歴から復元してください。別アプリで変更して一致しなくなった場合は書き込まず停止します。

## 開発・検証

```sh
npm test
npm run typecheck
npm run lint
npm run build
firebase emulators:exec --project demo-keymap-versions --only firestore 'npm test'
```

React / TypeScript / Vinext（Next.js App Router互換）/ WebHID / Firebase / Vitest。Firebase公開SDK設定は `lib/firebase/client.ts`。管理者鍵やAI APIキーは不要です。FirestoreルールのテストはFirebase CLIとJavaを使い、実プロジェクトへデータを書きません。通常の `npm test` ではエミュレータ用テストはスキップします。

Firebaseプロジェクトは `keymap-configurator`。Google認証と本人限定・追記専用のFirestoreルールを設定済みです。ルールは `firestore.rules`、索引除外は `firestore.indexes.json` で管理します。変更の反映にはプロジェクト権限を持つアカウントで `firebase deploy --only firestore` を実行します。Google認証・サポートメールはFirebase Consoleで設定します。管理者の既存CLI設定はGit管理外の `firebase.auth.local.json` に保持し、必要な場合のみ `firebase deploy --only auth --config firebase.auth.local.json` で反映できます。新しい公開ドメインを使う場合はFirebase Authenticationの承認済みドメインにも追加してください。

FirebaseのWeb SDK設定は公開識別子であり、管理者の認証情報ではありません（[Firebase公式説明](https://firebase.google.com/docs/projects/api-keys)）。フォークして自分の環境を運用する場合は、自分のFirebaseプロジェクトを作成し、`lib/firebase/client.ts`、`.firebaserc`、`firebase.json` のHostingサイトを置き換え、Google認証とFirestoreルールを設定してください。`.env*`、管理者用認証設定、開発環境固有の `.openai/` はGit管理しません。公開リポジトリだけで起動・静的ビルドできます。

## Firebase Hosting

公開先は [keymap-configurator.web.app](https://keymap-configurator.web.app)。`next.config.ts` の `output: 'export'` により、`npm run build` が `dist/client` に静的HTMLとアセットを生成します。サーバー処理のない現在の機能はこの出力だけで動作します。

```sh
# ビルドした成果物をローカルで確認（http://localhost:5007）
npm run build
firebase emulators:start --only hosting --project keymap-configurator

# 本番公開。predeployでも最新ビルドを生成する
firebase deploy --only hosting --project keymap-configurator
```

Hostingは `dist/client` だけを配信し、Firestoreルールやソース、管理用設定は公開対象に含みません。HTMLとRSCデータは再検証し、ハッシュ付きJS/CSSを長期キャッシュします。今後サーバーAPIを追加する場合は、別途その実行環境が必要です。

通信層はHIDの32byteレポートを直列化します。書込前の保存失敗、古い設定、機器ID不一致、書込後検証失敗、切断・タイムアウト・Undoの競合をテストします。OSのHIDダイアログや物理入力は自動テストで代替できません。

## 参照

独自TypeScriptクライアントの通信形式は[Vial公式の通信実装](https://github.com/vial-kb/vial-gui/blob/main/src/main/python/protocol/keyboard_comm.py)と[コマンド定義](https://github.com/vial-kb/vial-gui/blob/main/src/main/python/protocol/constants.py)を照合。32byte定義ブロックはlittle-endian、キーマップはbig-endian、読取bufferは最大28byteです。KLEラベル位置は[公式シリアライザ](https://github.com/vial-kb/vial-gui/blob/main/src/main/python/kle_serial.py)で確認しています。

作業記録: `.steering/20260910-minimum-keymap/`、`.steering/20260910-cornixlp-layout/`、`.steering/20260910-version-snapshots/`、`.steering/20260910-firebase-hosting/`。
