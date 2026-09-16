# 要求

- developとmainを使ったブランチ運用を導入する。
- mainへのpush時にテスト・ビルドを経てFirebase Hostingへ自動デプロイする。
- developとPRでは検証のみ実行し、mainはPRと検証成功を必須にする。
- 初回のGitHub Actions本番デプロイまで実行し、結果を確認する。
