# KOELOG

KOELOG は、音声または文字入力で日々の記録を残し、ユーザーの行動を定量化して振り返りと次の行動につなげる AI 秘書です。

現在はフロントエンド試作段階です。音声入力、文字入力、簡易カテゴリ判定、ブラウザ内保存、固定値ベースのダッシュボードを実装しています。

## 目指す体験

- 音声または文字で仕事、作業、健康、食事、支払い、締切、目標進捗を記録する
- 自然文から行動内容、作業時間、成果物、目標進捗、期限を構造化する
- 1日、1週間、1ヶ月の行動を振り返り、AI からアドバイスを受ける
- 支払い期限や締切をリマインドする
- 複数人で記録や進捗を共有する

詳しいテーマは [docs/product-theme.md](docs/product-theme.md) にまとめています。

システム全体の仕様案は [docs/system-spec.md](docs/system-spec.md) にまとめています。

MVP の実装ロードマップは [docs/mvp-roadmap.md](docs/mvp-roadmap.md) にまとめています。

## 現在できること

- 日本語の音声入力を開始する
- テキスト入力から複数の記録を追加する
- 正規表現ベースでカテゴリと値を簡易抽出する
- `localStorage` に記録を保存する
- 今日の記録、統計カード、AI コーチ枠、期限枠を表示する

## まだできないこと

- サーバー DB への永続化
- ユーザー認証
- 複数端末同期
- 複数人共有
- AI による本格的な自然文解析
- 月次振り返り
- 実通知によるリマインド

## 必要環境

- Node.js `>=22.13.0`

## セットアップ

```bash
npm install
```

## 開発

```bash
npm run dev
```

## ビルド

```bash
npm run build
```

## Database / Migration

DB は Neon PostgreSQL を使用します。Vercel では Development と Production で別 DB を接続しています。

- Development: `koelog-dev`
- Production: `koelog-prod`
- Preview: 未設定

ローカル開発では、Vercel の Development 環境から接続情報を取得します。

```bash
vercel link
vercel env pull .env.local --environment=development
```

接続文字列そのものはログやPR本文に貼らないでください。

### Drizzle

schema は `db/schema.ts`、migration は `drizzle/` に配置します。

```bash
npm run db:generate
```

生成された SQL をレビューしてから、Development DB にだけ適用します。

```bash
npm run db:migrate:dev
```

`db:migrate:dev` は `KOELOG_DB_TARGET=development` を明示して実行します。`drizzle.config.ts` は migration 実行時にこの値がない場合、誤適用防止のため失敗します。

Production DB への migration は、通常の `npm run dev`、`npm run build`、Vercel の通常デプロイでは実行しません。Production に適用する場合は、事前に以下を確認してから人間が明示的に実行します。

- 対象が `koelog-prod` であること
- 適用予定の migration ファイル
- Development で適用済み、動作確認済みであること
- 破壊的変更の有無
- 必要に応じたバックアップまたは復旧方法

## テスト

```bash
npm test
```

`npm test` は `next build` 後に、現在の KOELOG UI とブラウザ保存の前提がソース上に残っていることを確認します。

## デプロイ

デプロイ方針と確認項目は [docs/deployment.md](docs/deployment.md) にまとめています。

このリポジトリは通常の Next.js App Router アプリです。Vercel に GitHub リポジトリを接続すれば、標準設定で `npm install` と `npm run build` が実行されます。

### Vercel 設定

- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install`
- Output Directory: 未設定
- Node.js: `>=22.13.0`

### 環境変数

環境変数なしでも画面は動き、ブラウザの `localStorage` にフォールバックします。

サーバー側に記録を永続化する場合:

- `DATABASE_URL`: アプリ実行時の Postgres 接続 URL
- `POSTGRES_URL`: Vercel/Neon 連携が生成する代替名
- `DATABASE_URL_UNPOOLED`: migration 用 direct/non-pooling URL の候補
- `POSTGRES_URL_NON_POOLING`: migration 用 direct/non-pooling URL の候補
- `DATABASE_MIGRATION_URL`: 必要に応じて明示的に追加する migration 用 URL

今後、AI 解析、認証、通知を追加するときに環境変数を追加します。例:

- `OPENAI_API_KEY`: AI 解析や月次振り返りを使う場合に設定
- `OPENAI_MODEL`: AI 解析で使うモデル。未設定時は `gpt-4.1-mini`
- `AUTH_SECRET`: 認証を追加するときに使用

## 関連 issue

- #1 デプロイ導線を確立して実機確認できる状態にする
- #2 行動量・成果物・目標進捗を定量化するモデルを設計する
- #3 記録データを永続化する DB/API 基盤を作る
- #4 音声・文字入力を AI で構造化する
- #5 1ヶ月の行動を振り返る AI アドバイス機能を作る
- #6 支払い期限・締切のリマインド機能を設計する
- #7 現在の KOELOG 実装に合わせて README とテストを更新する
- #8 複数人で共有するためのユーザー・チーム・権限モデルを作る
