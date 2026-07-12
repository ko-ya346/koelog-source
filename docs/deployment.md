# KOELOG deployment

## 方針

KOELOG は通常の Next.js App Router アプリとして Vercel にデプロイする。

Cloudflare Workers、vinext、OpenAI Sites は使わない。

## ローカル確認

```bash
npm install
npm run build
```

開発サーバー:

```bash
npm run dev
```

## Vercel 設定

Vercel に GitHub リポジトリを接続し、以下の標準設定でデプロイする。

- Framework Preset: Next.js
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: 未設定
- Node.js Version: `>=22.13.0`

## 環境変数

環境変数なしでも画面は動き、ブラウザの `localStorage` にフォールバックする。

サーバー側に記録を永続化する場合:

- `POSTGRES_URL`: Vercel Postgres / Neon などの Postgres 接続 URL
- `DATABASE_URL`: `POSTGRES_URL` の代替として使用できる Postgres 接続 URL

今後の機能追加で必要になりうる環境変数:

- `OPENAI_API_KEY`: AI 解析や月次振り返り
- `AUTH_SECRET`: 認証
- `NEXT_PUBLIC_APP_URL`: 通知や外部連携でアプリ URL が必要な場合

## デプロイ前チェック

- `npm run build` が成功する
- `npm test` が成功する
- Vercel 固有の環境変数が必要な変更を入れた場合、Vercel 側にも同じ key を設定する
- 秘密値をリポジトリに commit しない

## 初期の実機確認項目

- トップページが表示される
- スマホ幅でレイアウトが崩れない
- テキスト入力から記録を追加できる
- 対応ブラウザで音声入力を開始できる
- リロード後に localStorage の記録が残る
- リセットボタンで初期サンプルに戻る
