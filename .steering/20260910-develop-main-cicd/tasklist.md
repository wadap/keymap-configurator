# Implementation Plan: develop/main CI/CD

**Goal:** developで開発しmainへのマージで検証済み成果物を自動公開する。
**Architecture:** 検証とOIDC認証デプロイを別ジョブに分離する。
**Tech Stack:** GitHub Actions、Firebase Hosting、Google Cloud WIF、Node24、Java21。
**Spec:** design.md

- [x] 現行設定・認証・公式仕様を確認
- [x] developを作成しCIワークフローと運用ドキュメントを実装
- [ ] Google Cloud再認証、専用SA・WIF・必要なIAMを設定
- [ ] ローカル検証、developへのpushでGitHub CIを確認
- [ ] production環境・Actions変数・main保護を設定
- [ ] developからmainへのPRをマージし、本番自動デプロイを確認
- [ ] developを同期し、既定ブランチと作業記録を仕上げる

検証コマンド: `npm run typecheck`、`npm run lint`、`npx oxfmt --check`、`firebase emulators:exec --project demo-keymap-versions --only firestore "npm test"`、`npm run build`。GitHubのPR・develop実行でDeploy productionがスキップされ、main実行で公開されることを確認する。
