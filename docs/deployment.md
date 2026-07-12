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

- `DATABASE_URL`: アプリ実行時の DB 接続 URL
- `DATABASE_URL_UNPOOLED`: migration など direct 接続が必要な処理の候補
- `POSTGRES_URL`: Vercel/Neon 連携で生成される DB 接続 URL
- `POSTGRES_URL_NON_POOLING`: migration など direct 接続が必要な処理の候補

今後の機能追加で必要になりうる環境変数:

- `OPENAI_API_KEY`: AI 解析や月次振り返りを使う場合に設定
- `OPENAI_MODEL`: AI 解析で使うモデル。未設定時は `gpt-4.1-mini`
- `AUTH_SECRET`: 認証
- `NEXT_PUBLIC_APP_URL`: 通知や外部連携でアプリ URL が必要な場合

## Neon / Vercel の環境構成

Vercel Marketplace から、以下の 2 つの Neon リソースを作成済み。

- `koelog-dev`
  - Vercel の Development 環境へ接続
  - ローカル開発および開発用 migration に使用する
- `koelog-prod`
  - Vercel の Production 環境へ接続
  - 本番アプリのデータ保存に使用する

Development と Production で同じ DB を共用しない。

Preview 環境の接続先は現時点では未確定。勝手に Production DB へ接続しない。Preview 用 DB が必要になった場合は、以下のいずれかを提案してから決める。

1. `koelog-dev` を Preview でも使用する
2. Preview 専用の Neon DB を追加する
3. Neon の database branch 機能を利用する

今回は Preview 環境の設定変更を必須としない。

## 環境変数名の確認方針

Vercel と Neon の連携によって、自動生成された環境変数名を確認してから実装する。環境変数名は推測しない。

2026-07-12 時点で Vercel CLI 55.0.0 を使って確認した環境変数名:

Development:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEON_AUTH_BASE_URL`
- `NEON_PROJECT_ID`
- `PGDATABASE`
- `PGHOST`
- `PGHOST_UNPOOLED`
- `PGPASSWORD`
- `PGUSER`
- `POSTGRES_DATABASE`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_USER`
- `VITE_NEON_AUTH_URL`

Production:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEON_AUTH_BASE_URL`
- `NEON_PROJECT_ID`
- `PGDATABASE`
- `PGHOST`
- `PGHOST_UNPOOLED`
- `PGPASSWORD`
- `PGUSER`
- `POSTGRES_DATABASE`
- `POSTGRES_HOST`
- `POSTGRES_PASSWORD`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_URL_NO_SSL`
- `POSTGRES_USER`
- `VITE_NEON_AUTH_URL`

Preview:

- 現時点では環境変数なし。
- Production DB へ接続しない。
- Preview を使う前に接続先を決める。

アプリ内部では可能な限り `DATABASE_URL` へ統一する。ただし Vercel/Neon 連携で以下のような別名が生成されている。

- `POSTGRES_URL`
- `DATABASE_URL_UNPOOLED`
- `POSTGRES_URL_NON_POOLING`

アプリ実行時の解決順は、実際に存在する env だけを使って以下を基本にする。

```ts
const databaseUrl = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
```

migration 実行時は direct/non-pooling 用の env を優先する。

```ts
const migrationDatabaseUrl =
  process.env.DATABASE_MIGRATION_URL ??
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.POSTGRES_URL_NON_POOLING;
```

`DATABASE_MIGRATION_URL` はまだ Vercel 側に存在しない。追加する場合は、値の参照元と用途を確認してから設定する。

存在しない環境変数名をむやみに増やさない。Custom Prefix は現時点では確認されていない。

DB 接続文字列そのものは、ログ、README、完了報告に出力しない。

## ローカル開発環境

ローカルでは Vercel の Development 環境から接続情報を取得して使用する。

想定手順:

```bash
vercel link
vercel env pull .env.local --environment=development
```

Vercel CLI 55.0.0 で上記コマンドが利用できることを確認済み。

`.env.local` が `koelog-dev` を指していることを確認する。接続先のホスト名、DB 名、接続文字列などの秘密情報は報告に含めない。

ローカル開発中に `koelog-prod` へ接続しない。

## migration の環境分離

通常の開発 migration は `koelog-dev` のみを対象にする。

Development の流れ:

```text
schema を変更
→ migration を生成
→ migration ファイルをレビュー
→ koelog-dev へ migration を実行
→ 動作確認
```

Production DB への migration は、明示的な操作でのみ実行する。

禁止事項:

- `npm run dev` 実行時の自動 migration
- `npm run build` 実行時の自動 migration
- Vercel の通常デプロイ時の無条件 migration
- 接続先が不明な状態での migration
- Development 用コマンドから Production DB への接続
- `koelog-prod` へのテーブル作成、テストデータ投入、接続確認用クエリ、schema push

Production migration を実行する場合は、事前に以下を確認する。

- 対象が `koelog-prod` であること
- 適用予定の migration ファイル
- dev 環境で適用済み・確認済みであること
- 破壊的変更の有無
- 必要に応じたバックアップまたは復旧方法

Production migration 用 npm script は、接続先を取り違えにくい名前にする。ただし環境変数の扱いが曖昧になる場合は無理に npm script を作らず、Vercel または CI 上で明示的に実行する安全な手順を採用する。

例:

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate:dev": "...",
    "db:migrate:prod": "..."
  }
}
```

今回、実際に migration を実行してよいのは `koelog-dev` のみ。`koelog-prod` へ変更が必要な場合は、実行前に人間へ確認する。

## Drizzle 設定方針

`drizzle.config.ts` は、コマンド実行時の環境変数から接続先を取得する。

接続文字列をファイル内へ直接書かない。環境変数がない場合は、接続文字列を表示せず、分かりやすいエラーにする。

```text
DATABASE_URL is not configured.
Pull the Vercel Development environment variables into .env.local.
```

アプリ実行時の DB クライアントと、Drizzle Kit による migration 用接続を混同しない。

Neon で pooled URL と direct URL が両方提供されている場合は、用途を確認してから使い分ける。

- アプリ実行時: サーバーレス環境に適した pooled 接続
- migration 実行時: Drizzle Kit が安定して migration を実行できる direct 接続

必要であれば以下のように分ける。現時点では `DATABASE_URL_UNPOOLED` と `POSTGRES_URL_NON_POOLING` が確認済みなので、まずはそれらを migration 用候補として扱う。

```env
DATABASE_URL=
DATABASE_MIGRATION_URL=
```

## DB 作業の完了報告に含める項目

DB や migration に関わる作業を完了するときは、秘密値を出さずに以下を報告する。

- Development で参照している環境変数名
- Production で参照している環境変数名
- Preview 環境が現在どの DB へ接続する設定か
- アプリ実行時に pooled 接続を使うか
- migration 時に direct 接続を使うか
- `koelog-dev` へ実行した migration
- `koelog-prod` へ変更を加えていないこと
- Production migration を行う際の手順
- Vercel 上で追加確認が必要な設定

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
