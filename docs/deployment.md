# KOELOG deployment

## 方針

KOELOG は vinext で Next.js App Router を Cloudflare Workers / OpenAI Sites 向けにビルドする。

このリポジトリにはすでに `.openai/hosting.json` があり、Sites の既存 project_id を使う。

```json
{
  "project_id": "appgprj_6a51f84a680c8191b390352ef1fff26a",
  "d1": null,
  "r2": null
}
```

## ローカル確認

```bash
npm install
npm run build
```

開発サーバー:

```bash
npm run dev
```

## デプロイ前チェック

- `npm run build` が成功すること
- `.openai/hosting.json` の `project_id` が変わっていないこと
- D1/R2 を使う変更がある場合、`.openai/hosting.json` と Sites 側の binding 方針を確認すること
- AI API キーなどの秘密値をリポジトリに置かず、Sites の環境変数で管理すること

## Sites への反映手順

Codex から Sites コネクタを使って反映する場合:

1. 変更を commit する
2. `git push` でリモートへ送る
3. Sites の既存 project_id に対して version を保存する
4. 保存済み version を本番へ deploy する
5. 発行された URL で表示確認する

Sites では、保存する version の `commit_sha` が push 済みの HEAD と一致している必要がある。

## 初期の実機確認項目

- トップページが表示される
- スマホ幅でレイアウトが崩れない
- テキスト入力から記録を追加できる
- 対応ブラウザで音声入力を開始できる
- リロード後に localStorage の記録が残る
- リセットボタンで初期サンプルに戻る

## 今後追加される運用項目

- D1: 記録、目標、期限、チーム共有の永続化
- 環境変数: AI 解析 API、通知 API、外部カレンダー連携など
- 認証: ChatGPT sign-in または別認証方式
- 通知: アプリ内通知、メール、push 通知のいずれか
- テスト: 現在の KOELOG UI に合ったレンダリングテスト
