# 設計

実機のブラウザ表示で50キー・10レイヤーを確認。左右が上下に並び、右側も行列順に反転している。definition.ts が layouts.labels の存在だけで物理座標を行列座標に置換していることが原因。メーカーの説明でも Layout タブにファームウェア情報を表示する仕様が確認できる。

labels 配列の有無ではなく、実際のキーにある物理バリアント指定（KLE正規化後のラベル8）を判定する。情報ラベルだけなら機器自身の座標を保持する。選択が必要な実際のバリアントは従来通り警告付き行列表示を残す。

キーボードは回転後の境界を含む比率でパネルに収める。Vial protocol 6 の MO/LM を表示用に解釈し、編集可否と送信値は変更しない。再読み込みでは配置定義も取得し直す。

参考（参照のみ。第三者の定義で実機を上書きしない）:

- https://docs.channel.io/jezailfunderjp/ja/articles/Cornix-ファームウェア-bf1534b6
- https://github.com/vial-kb/vial-gui/blob/main/src/main/python/keycodes/keycodes_v6.py
- https://github.com/adong660/rmk-cornix/blob/main/vial.json
