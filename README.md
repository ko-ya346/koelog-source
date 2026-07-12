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

## テスト

```bash
npm test
```

`npm test` は vinext build 後に、Worker 経由でトップページの HTML をレンダリングして確認します。

## デプロイ

デプロイ方針と確認項目は [docs/deployment.md](docs/deployment.md) にまとめています。

このリポジトリは vinext で Next.js App Router を Cloudflare Workers / OpenAI Sites 向けにビルドします。`.openai/hosting.json` の `project_id` を使って Sites の version 保存と production deploy を行います。

## データベース

`db/` には Cloudflare D1 + Drizzle の準備がありますが、現在の本体アプリではまだ使っていません。

- [db/schema.ts](db/schema.ts): 現時点では空
- [db/index.ts](db/index.ts): D1 binding から Drizzle client を作る helper
- [examples/d1/](examples/d1/): D1 を使う場合のサンプル

## 認証

[app/chatgpt-auth.ts](app/chatgpt-auth.ts) に Sign in with ChatGPT 用 helper がありますが、現在の画面ではまだ使っていません。

## 関連 issue

- #1 デプロイ導線を確立して実機確認できる状態にする
- #2 行動量・成果物・目標進捗を定量化するモデルを設計する
- #3 記録データを永続化する DB/API 基盤を作る
- #4 音声・文字入力を AI で構造化する
- #5 1ヶ月の行動を振り返る AI アドバイス機能を作る
- #6 支払い期限・締切のリマインド機能を設計する
- #7 現在の KOELOG 実装に合わせて README とテストを更新する
- #8 複数人で共有するためのユーザー・チーム・権限モデルを作る
