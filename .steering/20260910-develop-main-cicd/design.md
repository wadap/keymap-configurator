# 設計

- 既定ブランチをdevelop、本番公開ブランチをmainとする。
- `.github/workflows/ci.yml`にVerifyとDeploy productionを置く。Node24、Java21、Firebase CLI15.28.2を使用する。
- Verifyは型・lint・format・Firestoreエミュレータ下の全テスト・静的ビルド。全検証が成功したmain pushの成果物だけを認証ジョブへ渡す。
- Deploy productionはmain push限定、production環境限定。成果物のみを取得し、最新main SHAと照合する。
- Google Cloud Workload Identity Federationは所有者ID148186・リポジトリID1363520753・main push・ci.ymlの組み合わせに限定する。
- Hosting専用SAに必要な製品権限だけを付与。秘密鍵を発行しない。
- mainはPRとVerify成功を必須にし、強制pushと削除を禁止。個人開発のため承認レビュー数は0とする。
