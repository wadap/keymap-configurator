# Minimum Keymap Implementation Plan

Goal: 読み込み→1キー編集→適用→Undoができる最小版。
Architecture: ブラウザ内のWebHIDクライアントと、テスト可能な通信・トランザクション層。
Tech Stack: React, TypeScript, Vinext, WebHID, xz-decompress, Vitest。
Spec: requirements.md / design.md。

- [x] 雛形と依存関係、公式Vialプロトコル確認
- [x] 境界テストを先に作成（32byteプロトコル、エンディアン、機器ID、範囲、未知コード、保存失敗、競合、読戻し失敗、Undo）し、失敗を確認
- [x] 通信、定義解析、許可キー、snapshotとトランザクションの実装
- [x] サンプル、全レイヤー、キー選択、変更プレビュー、適用とUndoのUI
- [x] 接続失敗・切断・非対応ブラウザ・再接続時の履歴の処理
- [x] テスト21件、型検査、lint、本番ビルド、ローカルHTTP 200、npm audit 0件
- [x] README、機器の受入手順、残課題、作業記録更新
- [ ] 非公開プレビューの公開とURL確認（外部ソース送信の承認待ち。自動承認レビューがpushを拒否。ローカル版は完成）
