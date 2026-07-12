# KOELOG system spec

## 目的

KOELOG は、音声または文字入力で日々の行動を記録し、行動量、成果物、目標進捗、期限を定量化する AI 秘書。

この仕様は、Vercel 上で通常の Next.js App Router アプリとして運用する前提で、MVP 実装時にユーザー、workspace、データ構造、権限、AI 処理フローで迷わない状態にするための設計である。

## 基本方針

- アプリは Vercel にデプロイする。
- DB は Postgres を使う。推奨案は Neon または Vercel Postgres。代替案は Supabase Postgres。
- 認証は Clerk を第一候補にする。
- Clerk はログイン認証だけを担当する。
- KOELOG 側の DB が `users`, `workspaces`, `workspace_members`, role 管理を担当する。
- MVP では Clerk Organizations は使わない。
- ユーザーがログインするアカウントと、KOELOG 内で切り替える作業単位を分ける。
- KOELOG 内の作業単位は `workspace` と呼ぶ。
- AI API は必ずサーバー側 Route Handler から呼ぶ。ブラウザに OpenAI API key を渡さない。
- AI の出力は候補として扱い、正式データとして直接保存しない。
- MVP は過度な正規化を避け、後から分離しやすい単純な構造を優先する。

## 現在の実装との関係

現在の実装はプロトタイプで、以下の点がこの仕様とまだ一致していない。

- `records` 相当のデータは `Log` 型と `localStorage` fallback に残っている。
- `category` は `仕事`, `健康`, `食事`, `期限`, `目標`, `メモ` の日本語値を使っている。
- `/api/analyze` は現在 `records` 候補だけを返す。
- `/api/analyze` の結果は保存前確認 UI を挟まず、そのまま保存処理へ渡している。
- `/api/monthly-review` は現在、画面上の `logs` を直接受け取ってレビューを生成している。
- Clerk middleware と `POST /api/bootstrap` で、認証済みuserの初回DB初期化を行う。
- records CRUD の workspace 認可とDB保存切り替えは未実装。

MVP 実装では、この仕様に合わせて内部データ構造と処理フローを変更する。

## MVP 分割

### MVP 1: 記録入力が便利になるかを検証

最初に検証したい仮説:

> 声や自然文で入力することで、手入力よりも日々の記録を継続しやすくなるか。

MVP 1 に含める:

- Clerk 認証
- 初回ログイン時の user 作成
- personal workspace 自動作成
- workspace membership 作成
- テキスト入力
- 対応ブラウザでの音声入力
- AI による構造化候補
- ユーザーによる候補の確認・修正
- record 保存
- record 一覧
- record 編集・削除

MVP 1 から外す:

- 共有 workspace
- 招待
- goals
- goal_events
- deadlines の正式管理
- 月次レビューの保存
- push 通知
- カレンダー連携

### MVP 2: 記録が目標達成に役立つかを検証

MVP 2 に含める:

- dashboard の実データ集計
- goals
- goal_events
- deadlines
- 月次レビュー
- 共有 workspace
- 招待・権限管理

## 認証とユーザー作成

### 採用方針

MVP では Clerk を使う。

Clerk が担当する:

- ログイン認証
- OAuth/email 認証
- セッション
- ログインアカウント切り替え

KOELOG DB が担当する:

- アプリ内 user
- workspace
- workspace membership
- role
- user の timezone

Clerk Organizations は MVP では使わない。Clerk Organizations と自前 workspace を併用すると同期処理が必要になるため、まずは自前 workspace のみで実装する。将来、組織課金や管理画面が必要になった時点で再検討する。

### 初回ログイン時の冪等な作成フロー

初回ログイン後、アプリ利用前に以下を同一トランザクションで実行する。

1. Clerk user id に対応する `users` がなければ作成する。
2. その user の personal workspace がなければ作成する。
3. `workspace_members` に `owner` として登録する。

この処理は複数回実行されても重複しないこと。

MVP では `POST /api/bootstrap` を初回アクセス時に呼び出し、この処理を実行する。Clerk が未設定のローカル環境では、このAPIは 503 を返し、既存プロトタイプUIの表示を妨げない。

推奨する一意制約:

- `users(auth_provider, auth_user_id)` UNIQUE
- `workspaces(personal_owner_user_id)` UNIQUE WHERE `type = 'personal'`
- `workspace_members(workspace_id, user_id)` UNIQUE

MVP では Clerk webhook による事前同期ではなく、初回ログイン時または初回リクエスト時に作成する方式を採用する。理由は実装とローカル検証が単純で、webhook の再送・署名検証・失敗時リトライ設計を MVP 1 から外せるため。

## アカウント切り替えと workspace

アカウント切り替えは 2 種類に分ける。

### ログインアカウント切り替え

Google/email などの認証アカウントを切り替えること。

これは Clerk の session/account switching に任せる。

### workspace 切り替え

KOELOG 内で、個人、家族、チーム、プロジェクトを切り替えること。

MVP 1 では personal workspace だけを作る。MVP 2 で共有 workspace を追加する。

personal workspace:

- その user だけが owner として所属する。
- 健康、食事、仕事時間など私的な情報を前提に扱う。
- 初期表示は personal workspace。

shared workspace:

- 複数 user が membership を持つ。
- メンバーは workspace 内の共有データを閲覧できる。
- MVP では項目単位の公開・非公開設定は実装しない。
- 私的情報を shared workspace に記録すると他メンバーから見えるため、UI 上で workspace が分かる表示を必ず置く。

## セキュリティと認可

### 基本ルール

- クライアントから送られた `workspace_id` をそのまま信用しない。
- すべての API または Server Action は、処理前に workspace membership を確認する。
- DB の取得・更新・削除条件には常に認可済みの `workspace_id` を含める。
- ID 指定で別 workspace のデータを参照・更新できないようにする。
- 各 API handler に個別実装を散らさず、共通関数または service 層を通す。

共通認可関数のイメージ:

```ts
const context = await requireWorkspaceAccess({
  authUserId,
  workspaceId,
  minimumRole: "member",
});
```

`context` には少なくとも以下を含める。

- `userId`
- `workspaceId`
- `role`
- `timezone`

DB アクセスでは `context.workspaceId` と `context.userId` を使う。

### role

MVP の role:

- `owner`
- `admin`
- `member`
- `viewer`

権限:

- `owner`
  - workspace 全体の管理
  - メンバー管理
  - 全データの閲覧・編集・削除
- `admin`
  - workspace 内の全データの閲覧・編集・削除
- `member`
  - データ作成
  - 自分が作成したデータの編集・削除
  - 他メンバーのデータは閲覧のみ
- `viewer`
  - 閲覧のみ

このため、`records`, `goals`, `deadlines`, `ai_reviews` には `created_by_user_id` または `generated_by_user_id` を持たせる。

完全共同編集型にはしない。理由は、健康、食事、仕事時間などの私的な情報を扱うため、member が他人の記録を無条件で編集できる設計は MVP には強すぎる。

## データ責務

### records

`records` は、ユーザーが実際に行ったこと、観測したこと、残したメモの履歴。

例:

- 体重 72.4kg だった
- 3km 走った
- 資料作成を 2 時間やった
- 英語を 20 分勉強した

`records` は将来の予定や達成したい状態そのものを表さない。

### goals

`goals` は、将来達成したい状態。

例:

- 今月 60km 走る
- 英語学習を 20 時間行う
- 体重を 70kg にする

### deadlines

`deadlines` は、将来までに対応する必要がある期限。

例:

- 7月31日までに電気代を払う
- 8月10日までに原稿を提出する

### goal_events

`goal_events` は、`record` によって発生した目標進捗の履歴。

例:

- `今日は3km走った` という record により、`今月60km走る` goal に `+3km` の goal_event が発生する。

1 回の自然文入力から、複数種類の候補が生成される。

- `今日は3km走った`
  - `record` 候補を作る。
  - 関連する goal が存在する場合は `goal_event` 候補も作る。
- `7月31日までに電気代を払う`
  - `deadline` 候補を作る。
  - 必要であれば元入力の履歴として `record` 候補も作る。

## record category

DB に保存する category は英語の内部値にする。日本語表示は UI 側で行う。

MVP の category:

- `work`
- `health`
- `meal`
- `learning`
- `creation`
- `household`
- `memo`
- `other`

`deadline` と `goal` は `records.category` には含めない。期限は `deadlines`、目標は `goals` と `goal_events` で表す。

現在の実装では日本語 category を使っているため、MVP 実装時に移行する。

## 定量値

MVP では過度な正規化を避け、`records` に集計可能な最小カラムを持たせる。

`records` の定量値カラム:

- `metric`: text, nullable
- `value_numeric`: numeric, nullable
- `unit`: text, nullable
- `duration_minutes`: integer, nullable
- `value_text`: text, nullable

使い分け:

- 数値化できる値は `metric`, `value_numeric`, `unit` に入れる。
- 時間の記録は `duration_minutes` に正規化する。
- 数値化できない値は `value_text` に入れる。
- 表示用の短い値は UI で組み立てる。必要なら後続で `display_value` を追加する。

例:

```text
体重72.4kgだった
metric = body_weight
value_numeric = 72.4
unit = kg
value_text = null
```

```text
今日は3km走った
metric = running_distance
value_numeric = 3
unit = km
```

```text
資料作成を2時間やった
metric = work_duration
duration_minutes = 120
unit = minute
```

```text
読書20ページ
metric = reading_pages
value_numeric = 20
unit = page
```

```text
支出1,500円
metric = expense
value_numeric = 1500
unit = jpy
```

将来、1 record に複数 metric が必要になったら `record_metrics` へ分離する。MVP では 1 record につき主要 metric 1 つを基本にする。

## goals.current_value と goal_events

MVP では `goals.current_value` を原則として持たない。現在値は `goal_events.delta_value` の合計から算出する。

理由:

- 二重管理を避ける。
- record の編集・削除、goal_event の補正時に不整合が起きにくい。
- 再計算が単純。

将来、パフォーマンス上 `goals.current_value` が必要になった場合はキャッシュ値として扱う。その場合のルール:

- `goal_event` の作成・更新・削除と同一トランザクションで更新する。
- 不整合が起きた場合に `goal_events` から再計算できる。
- `delta_value` は正の値、取り消し、補正の負の値を許容する。
- `current_value` は直接編集しない。

MVP でも `goal_events.delta_value` は負の値を許容する。理由は、誤入力の補正や取り消しを履歴として扱えるため。

## DB スキーマ概念設計

型は Postgres を想定する。

### users

- `id`: uuid primary key
- `auth_provider`: text not null
- `auth_user_id`: text not null
- `display_name`: text null
- `timezone`: text not null default `Asia/Tokyo`
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

制約:

- unique (`auth_provider`, `auth_user_id`)

削除:

- MVP では UI から user 削除を提供しない。

補足:

- MVP の初期化は Clerk の認証 ID だけで成立させる。
- email は MVP では保存しない。将来、招待、通知、検索に必要になった時点で nullable な連絡先情報として追加する。

### workspaces

- `id`: uuid primary key
- `name`: text not null
- `type`: text not null check in (`personal`, `shared`)
- `created_by_user_id`: uuid not null references users(id) on delete restrict
- `personal_owner_user_id`: uuid null references users(id) on delete restrict
- `timezone`: text null
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

制約:

- unique (`personal_owner_user_id`) where `type = 'personal'`
- `type = 'personal'` の場合は `personal_owner_user_id` is not null
- `type <> 'personal'` の場合は `personal_owner_user_id` is null

補足:

- `shared` は家族、友人、チーム、プロジェクト共有を含む。
- `team` という内部値は採用しない。人間関係の範囲がチームに限られないため。

index:

- (`created_by_user_id`)

削除:

- workspace 削除は MVP では UI から提供しない。
- 大量データ削除を避けるため、安易な cascade delete は使わない。

### workspace_members

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `user_id`: uuid not null references users(id) on delete restrict
- `role`: text not null check in (`owner`, `admin`, `member`, `viewer`)
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

制約:

- unique (`workspace_id`, `user_id`)

index:

- (`user_id`)
- (`workspace_id`, `role`)

削除:

- MVP では member 削除は shared workspace 実装時に設計する。

### records

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `created_by_user_id`: uuid not null references users(id) on delete restrict
- `category`: text not null check in (`work`, `health`, `meal`, `learning`, `creation`, `household`, `memo`, `other`)
- `title`: text not null
- `source_text`: text null
- `metric`: text null
- `value_numeric`: numeric null
- `unit`: text null
- `duration_minutes`: integer null check `duration_minutes is null or duration_minutes >= 0`
- `value_text`: text null
- `occurred_at`: timestamptz not null
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()
- `deleted_at`: timestamptz null

index:

- (`workspace_id`, `occurred_at` desc) where `deleted_at is null`
- (`workspace_id`, `created_by_user_id`, `occurred_at` desc) where `deleted_at is null`
- (`workspace_id`, `category`, `occurred_at` desc) where `deleted_at is null`

削除:

- ユーザー操作で削除可能。
- MVP では `deleted_at` による soft delete を推奨する。
- 通常の一覧、集計、AI 解析対象の取得では必ず `deleted_at is null` を条件に含める。
- 削除操作は `deleted_at` と `updated_at` を同一更新で設定する。
- hard delete する場合も、関連 deadline は `record_id set null`、goal_event は方針に従う。

### updated_at の更新方針

`updated_at` の `default now()` は INSERT 時の初期値であり、UPDATE 時には自動更新されない。

MVP では DB trigger ではなく、repository/service 層で更新時に必ず `updated_at = now()` を設定する。理由は、Drizzle の更新処理と同じ場所で business rule、認可、soft delete を扱えるため。

実装方針:

- table ごとの更新処理を repository/service 関数に集約し、Route Handler から直接 `db.update(...)` を呼ばない。
- 通常更新、soft delete、補正更新のすべてで `updated_at` を同時に更新する。
- `updatedAtNow()` のような共通helper、または `updateRecord(...)`, `softDeleteRecord(...)` などの専用関数で漏れを防ぐ。
- テストでは更新前後で `updated_at` が変わることを確認する。

### goals

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `created_by_user_id`: uuid not null references users(id) on delete restrict
- `title`: text not null
- `description`: text null
- `metric`: text not null
- `target_value`: numeric not null
- `unit`: text not null
- `starts_on`: date null
- `ends_on`: date null
- `status`: text not null check in (`active`, `completed`, `archived`)
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

index:

- (`workspace_id`, `status`)
- (`workspace_id`, `created_by_user_id`)

削除:

- 原則として物理削除しない。
- ユーザー操作では `archived` にする。

### goal_events

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `goal_id`: uuid not null references goals(id) on delete restrict
- `record_id`: uuid null references records(id) on delete set null
- `created_by_user_id`: uuid not null references users(id) on delete restrict
- `delta_value`: numeric not null
- `unit`: text not null
- `note`: text null
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

index:

- (`workspace_id`, `goal_id`, `created_at`)
- (`workspace_id`, `record_id`)

削除:

- goal は archived を基本にするため、goal_event は残す。
- record が削除された場合は `record_id` を null にし、進捗履歴は残す。
- 誤入力は負の delta_value を持つ補正 event で扱うことを推奨する。

### deadlines

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `created_by_user_id`: uuid not null references users(id) on delete restrict
- `record_id`: uuid null references records(id) on delete set null
- `title`: text not null
- `due_date`: date null
- `due_at`: timestamptz null
- `timezone`: text null
- `status`: text not null check in (`open`, `done`, `dismissed`)
- `remind_at`: timestamptz null
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

日付:

- 日付だけの期限は `due_date` に入れる。
- 特定時刻までの期限は `due_at` に UTC で入れる。
- `due_date` と `due_at` のどちらかは必須。

index:

- (`workspace_id`, `status`, `due_date`)
- (`workspace_id`, `status`, `due_at`)
- (`workspace_id`, `created_by_user_id`)

削除:

- record 削除時は `record_id` を null にする。
- deadline 自体は `done` または `dismissed` で状態管理する。

### ai_reviews

- `id`: uuid primary key
- `workspace_id`: uuid not null references workspaces(id) on delete restrict
- `period_start`: date not null
- `period_end`: date not null
- `title`: text null
- `body`: text null
- `input_hash`: text not null
- `prompt_version`: text not null
- `model`: text not null
- `status`: text not null check in (`pending`, `completed`, `failed`)
- `generated_by_user_id`: uuid not null references users(id) on delete restrict
- `error_message`: text null
- `created_at`: timestamptz not null default now()
- `updated_at`: timestamptz not null default now()

制約:

- unique (`workspace_id`, `period_start`, `period_end`, `input_hash`)

index:

- (`workspace_id`, `period_start`, `period_end`)
- (`workspace_id`, `status`)

## AI 解析フロー

AI 解析結果は正式データとして直接保存しない。

フロー:

```text
音声またはテキスト入力
→ POST /api/analyze
→ AI が構造化候補を返す
→ クライアント側で候補を一時保持
→ ユーザーが内容を確認・修正
→ 正式な作成処理を実行
```

`/api/analyze` は `records`, `goals`, `deadlines`, `goal_events` の正式データを直接作成しない。

レスポンス構造:

```json
{
  "records": [],
  "goals": [],
  "deadlines": [],
  "goalEvents": [],
  "warnings": []
}
```

各候補に含める情報:

- `sourceText`: 元の入力文
- `interpretedText`: AI が解釈した内容
- `confidence`: 0 から 1
- `missingFields`: 不足している情報
- `warnings`: ユーザー確認が必要な警告

サーバー側では AI 出力を必ず schema validation する。validation に失敗した候補は正式候補として返さず、`warnings` に入れる。

## 音声入力

MVP ではブラウザの音声認識を使う。

フロー:

```text
マイク入力
→ ブラウザで文字起こし
→ テキストだけを解析 API へ送信
```

方針:

- 音声データ自体はサーバーへ保存しない。
- 音声ファイルをサーバーへ送らない。
- 音声認識が使えない場合はテキスト入力へフォールバックする。
- MVP の対象は Web Speech API に対応するブラウザ。主に Chrome 系ブラウザを想定する。
- Safari や Firefox では挙動差があるため、テキスト入力を常に利用可能にする。

音声ファイルをサーバーに送る方式は、ストレージ、同意、削除、プライバシー設計が増えるため MVP では採用しない。

## AI API へ送るデータ

AI API には分析に必要な範囲だけを送る。

送ってよいもの:

- 対象 workspace の ID ではなく、必要なら匿名化された内部識別子
- 対象期間
- 対象カテゴリ
- 必要な records の要約
- 必要な goals の要約
- 必要な deadlines の要約
- 集計結果

送らないもの:

- email
- Clerk user id
- auth provider id
- 不要な個人識別情報
- workspace member の一覧
- API key や token

送信前に行うこと:

- 件数制限
- 文字数制限
- 対象期間の制限
- サーバー側で集計・要約
- 必要に応じて user 名を匿名化

共有 workspace の月次レビューでは、原則として workspace 全体の共有データを対象にする。個人別レビューを作る場合は、対象 user を明示し、その user の閲覧権限を確認する。

## ai_reviews の再生成条件

`input_hash` には以下を含めて計算する。

- `workspace_id`
- `period_start`
- `period_end`
- 対象データの ID
- 対象データの `updated_at`
- `prompt_version`
- `model`
- 集計ロジックの version

同じ期間でも、対象データ、プロンプト、モデル、集計方法が変われば再生成可能にする。

月次レビュー生成の推奨フロー:

1. サーバー側で対象期間の records / goals / deadlines を取得する。
2. 必要な集計・要約を行う。
3. `input_hash` を計算する。
4. 同じ `input_hash` の completed review があれば再利用する。
5. なければ AI に送信して生成する。
6. 結果を `ai_reviews` に保存する。

## timezone と日付

- DB の timestamp は UTC で保存する。
- 画面表示時に timezone 変換する。
- user ごとの表示 timezone は `users.timezone` を使う。
- shared workspace の集計 timezone は将来的に `workspaces.timezone` を使う。
- MVP 1 では shared workspace を実装しないため、集計は `users.timezone` を使う。
- MVP 2 で shared workspace を実装する時に `workspaces.timezone` を有効化する。

日次・月次集計:

- 日次境界は対象 timezone の 00:00:00 から 23:59:59.999。
- 月次境界は対象 timezone の月初 00:00:00 から翌月初直前。
- DB 取得時は timezone 境界を UTC に変換して検索する。

deadline:

- 日付だけの期限は `due_date` に保存する。
- 時刻付き期限は `due_at` に UTC で保存する。
- 日付だけの期限は UI では対象 timezone の終日期限として扱う。

## API / Server Actions の責務

MVP では Route Handler と service 層を使う。Server Actions は必須にしない。

責務:

- Route Handler
  - HTTP 入力を受ける
  - schema validation
  - 認証 user の取得
  - service 層の呼び出し
- service 層
  - workspace 認可
  - DB transaction
  - business rule
  - workspace_id を含む DB access
- DB access 層
  - SQL 実行
  - table ごとの基本 query
- Client component
  - 入力
  - AI 候補の一時保持
  - 確認・修正 UI
  - 正式作成 API の呼び出し

主要 API:

```text
GET    /api/records
POST   /api/records
PATCH  /api/records/:id
DELETE /api/records/:id

GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id

GET    /api/deadlines
POST   /api/deadlines
PATCH  /api/deadlines/:id

POST   /api/bootstrap
POST   /api/analyze
POST   /api/monthly-review
```

正式作成系 API は AI 候補を直接信用しない。クライアントから送られた最終データを schema validation し、認可済み workspace に対して保存する。

## ユースケース

### ケース1: 体重72.4kgだった

入力:

```text
体重72.4kgだった
```

AI 解析候補:

- records
  - category: `health`
  - title: `体重`
  - metric: `body_weight`
  - value_numeric: `72.4`
  - unit: `kg`
  - value_text: null
  - occurred_at: 入力日
- warnings: []

ユーザー確認:

- title、category、数値、unit を確認・修正できる。

保存:

- `records` に 1 行保存する。
- `goals` が体重目標を持っていても、体重は通常 delta ではなく観測値なので、MVP では goal_event 自動作成はしない。

### ケース2: 今日は3km走った

入力:

```text
今日は3km走った
```

AI 解析候補:

- records
  - category: `health`
  - title: `ランニング`
  - metric: `running_distance`
  - value_numeric: `3`
  - unit: `km`
- goalEvents
  - 関連 goal がある場合のみ候補を返す。
  - goal_id: 候補
  - delta_value: `3`
  - unit: `km`

ユーザー確認:

- record 候補を確認する。
- 関連 goal_event 候補を採用するか外すか選ぶ。

保存:

- record と採用された goal_event を同一トランザクションで保存する。
- goal 現在値は `goal_events.delta_value` の合計で再計算する。

### ケース3: 7月31日までに電気代を払う

入力:

```text
7月31日までに電気代を払う
```

AI 解析候補:

- deadlines
  - title: `電気代を払う`
  - due_date: `YYYY-07-31`
  - due_at: null
  - timezone: user timezone
  - status: `open`
- records
  - 必要に応じて source history として `memo` record 候補を返す。

日付解釈:

- 年が省略された場合は user timezone の現在日付を基準に近い未来の日付として解釈する。
- 曖昧な場合は warning を返し、ユーザー確認を必須にする。

通知未実装時:

- MVP ではアプリ内 deadline 一覧に表示する。
- push/email 通知は行わない。

### ケース4: 今日は資料作成を2時間やって、英語を20分勉強した

入力:

```text
今日は資料作成を2時間やって、英語を20分勉強した
```

AI 解析候補:

- records 2 件
  - category: `work`
    - title: `資料作成`
    - metric: `work_duration`
    - duration_minutes: `120`
    - unit: `minute`
  - category: `learning`
    - title: `英語学習`
    - metric: `learning_duration`
    - duration_minutes: `20`
    - unit: `minute`

ユーザー確認:

- 2 件の候補を個別に修正・削除できる。

保存:

- 一括保存時は同一トランザクションで保存する。
- 1 件でも validation に失敗したら保存せず、ユーザーに修正を促す。

## リマインド

MVP 1 では正式な deadline 管理は実装しない。MVP 2 でアプリ内リマインドを実装する。

MVP 2 の方針:

- AI が deadline 候補を返す。
- ユーザーが確認して `deadlines` に保存する。
- ダッシュボードに近い期限を表示する。
- push/email 通知は後回し。

後続で検討する通知手段:

- email
- push notification
- calendar integration
- Slack/LINE 連携

## 未決定事項

- Postgres provider を Neon、Vercel Postgres、Supabase Postgres のどれにするか。
- Clerk で使う login provider。推奨案は Google + email。
- shared workspace の timezone をいつ実装するか。
- AI 構造化候補の確認 UI をモーダルにするか、入力欄下の編集リストにするか。
- 月次レビューを MVP 2 のどの時点で入れるか。
- 通知手段の初期実装をアプリ内だけにするか、メールまで入れるか。
- OpenAI API は現在の実装を維持するか、公式推奨に合わせて Responses API へ寄せるか。
