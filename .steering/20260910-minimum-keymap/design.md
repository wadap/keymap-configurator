# 設計

React / TypeScript のクライアントで状態・通信・履歴を管理。Sites starter の Vinext（Next.js App Router互換）を使用。外部API、AIサービス、データベースは不要。

`lib/keyboard/types.ts`: 読み込んだキーボード、物理キー、1キー変更。
`keycodes.ts`: USB HID基本コードの許可リストと表示。未知コードは16進表記で保持。
`definition.ts`: 機器のXZ JSON展開、matrix検証、KLE位置の変換。選択レイアウトは初期オプションのみ表示、複雑な定義はmatrix表示へフォールバック。
`transport.ts`: WebHIDの32byteレポート、直列化、タイムアウト時のセッション無効化。
`vial.ts`: 公式プロトコルに基づく機器ID、定義、全keymapの読取と1キー書込。
`transactions.ts`: 事前再読込→差分の競合検査→永続snapshot→書込→読戻し。Undoも現在値の一致を検査。失敗時は書込結果不明としてsnapshotを保持。
`app/page.tsx`, `components/keyboard/*`: サンプル/実機を区別した編集画面。

視覚方針: グレーの作業台にアイボリーのキーキャップ、ネイビーの操作面とブルーの選択。主役は分割キーボード。余白を持った2カラム、右に1キーの編集と差分、下に履歴。日本語を主文、キー名はOSに依存しない記号。本文16px、補助14px。装飾画像は不要。

制約: Vial 0〜6 / VIA 9 を対象。未知バージョンは停止。実機の高度な割当を通常キーへ置換させず、レイヤー入口を保存。通常キーでも唯一のEnter/Escape/修飾キーを削る操作は保守的に禁止。完全なレイヤー到達解析は実装しない。
