# 決定事項

- ユーザーのGitHub保存・public可の依頼に基づき公開リポジトリを作成する。
- 既存の個人用履歴を外部へ送らず、公開用初回コミットにまとめる。ローカルの既存ブランチは保管し、公開後はmainだけをpushする。
- Firebase Authのサポートメールを公開設定から分離する。既存の本番認証設定は変更しない。
- ライセンスの新規付与や自動デプロイの追加は今回の範囲外。

- 元のmainは `archive/local-main-before-public`、最新の開発履歴は `feat/version-snapshots` としてローカルに保持。これらは公開用の履歴ではないため、push対象はmainだけに設定した。
- 公開作業後のローカル作業ブランチはmain、追跡先はorigin/main。GitHubリポジトリのHomepageを既存Firebase Hosting URLに設定した。
