# KOELOG system spec

## 目的

KOELOG は、音声または文字入力で日々の行動を記録し、行動量、成果物、目標進捗、期限を定量化する AI 秘書。

この仕様は、Vercel 上で運用する前提で、ユーザーアカウント、ワークスペース、データ保存、AI 機能、共有権限の責務を決める。

## 基本方針

- アプリは通常の Next.js App Router として Vercel にデプロイする。
- DB は Postgres を使う。候補は Vercel Postgres、Neon、Supabase Postgres。
- 認証は Clerk を第一候補にする。
- ユーザーが見るログインアカウントと、KOELOG 内で切り替える作業単位を分ける。
- KOELOG 内の切り替え単位は workspace と呼ぶ。
- AI API は必ずサーバー側 API route から呼ぶ。ブラウザに OpenAI API key を渡さない。
- AI の出力は候補として扱い、重要な構造化データはユーザー確認後に保存する。

## 認証

### 採用方針

MVP では Clerk を使う。

理由:

- Google/email 認証を早く導入できる。
- ユーザー情報、セッション、アカウント切り替え、組織機能の土台がある。
- 将来のチーム共有に拡張しやすい。

### 認証プロバイダに持たせる情報

- email
- display name
- avatar
- login provider
- session
- provider user id

### アプリ DB に持つ情報

認証プロバイダの情報をそのまま信頼境界にせず、アプリ DB に KOELOG 用 user を作る。

`users`

- `id`
- `auth_provider`
- `auth_user_id`
- `email`
- `display_name`
- `timezone`
- `created_at`
- `updated_at`

## アカウント切り替え

アカウント切り替えは 2 種類に分ける。

### ログインアカウント切り替え

Google/email などの認証アカウント切り替え。

これは Clerk の session/account switching に任せる。

### ワークスペース切り替え

KOELOG 内で、個人、家族、チーム、プロジェクトを切り替える機能。

MVP では全ユーザーに個人 workspace を 1 つ自動作成する。複数人共有は workspace を共有することで実現する。

`workspaces`

- `id`
- `name`
- `type`: `personal` or `team`
- `created_by_user_id`
- `created_at`
- `updated_at`

`workspace_members`

- `id`
- `workspace_id`
- `user_id`
- `role`: `owner`, `admin`, `member`, `viewer`
- `created_at`

## 権限

MVP の権限は workspace 単位で判定する。

- `owner`: workspace 設定、メンバー管理、全データ編集、削除
- `admin`: メンバー招待、全データ編集
- `member`: 記録、目標、期限の作成・編集
- `viewer`: 閲覧のみ

すべての API は `workspace_id` とログインユーザーの membership を確認する。

## データモデル

### records

日々の行動ログ。

- `id`
- `workspace_id`
- `created_by_user_id`
- `category`: `仕事`, `健康`, `食事`, `期限`, `目標`, `メモ`
- `title`
- `value`
- `source_text`
- `occurred_at`
- `created_at`
- `updated_at`

### goals

目標。

- `id`
- `workspace_id`
- `created_by_user_id`
- `title`
- `description`
- `target_value`
- `current_value`
- `unit`
- `starts_on`
- `ends_on`
- `status`: `active`, `completed`, `archived`
- `created_at`
- `updated_at`

### goal_events

記録と目標進捗の関連。

- `id`
- `workspace_id`
- `goal_id`
- `record_id`
- `delta_value`
- `note`
- `created_at`

### deadlines

支払い期限、締切、予定リマインド。

- `id`
- `workspace_id`
- `created_by_user_id`
- `record_id`
- `title`
- `due_at`
- `status`: `open`, `done`, `dismissed`
- `remind_at`
- `created_at`
- `updated_at`

### ai_reviews

月次振り返りやアドバイス。

- `id`
- `workspace_id`
- `period_start`
- `period_end`
- `title`
- `body`
- `input_hash`
- `model`
- `created_at`

## AI 機能

### 原則

- AI はサーバー側 API route から呼ぶ。
- AI key は `OPENAI_API_KEY` として Vercel 環境変数に置く。
- モデルは `OPENAI_MODEL` で上書き可能にする。
- AI の出力は候補。DB に保存する前に、ユーザーが確認・編集できる UI を用意する。
- 同じ入力に対する高コスト処理は cache する。

### API

`POST /api/analyze`

- 自然文を records / deadlines / goal_events の候補へ構造化する。
- `OPENAI_API_KEY` がない場合はローカル parser にフォールバックする。

`POST /api/monthly-review`

- 指定 workspace と期間の records / goals / deadlines を集計し、月次レビューを作る。
- 結果は `ai_reviews` に保存する。
- 同じ期間・同じ入力なら再生成しない。

`POST /api/suggestions`

- 次の行動提案を返す。
- MVP では月次レビュー API に統合してよい。

## リマインド

MVP ではアプリ内リマインドから始める。

- 記録から deadline 候補を抽出する。
- ユーザーが確認して `deadlines` に保存する。
- ダッシュボードに近い期限を表示する。

後続で検討する通知手段:

- email
- push notification
- calendar integration
- Slack/LINE 連携

## MVP スコープ

最初に作るもの:

- Clerk 認証
- 個人 workspace 自動作成
- workspace 単位の records 保存
- 入力テキストの AI 構造化候補
- record 作成・一覧
- dashboard の実データ集計
- deadline 候補抽出と一覧表示
- 月次レビューの手動生成

後回し:

- 複雑な組織管理
- 複数 workspace の高度な権限
- push 通知
- カレンダー連携
- AI 自動実行のスケジューリング
- 詳細な監査ログ

## 環境変数

必須:

- `DATABASE_URL` or `POSTGRES_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

任意:

- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `NEXT_PUBLIC_APP_URL`

## 未決定事項

- Postgres provider を Vercel Postgres、Neon、Supabase のどれにするか。
- Clerk Organizations を使うか、自前 workspace のみにするか。
- AI 構造化結果を保存前に必ず確認させる UI をどこに置くか。
- 月次レビューを自動生成するか、ユーザー操作で生成するか。
- 通知手段の初期実装をアプリ内だけにするか、メールまで入れるか。
