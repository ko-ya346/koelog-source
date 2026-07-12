# KOELOG MVP roadmap

## 目的

KOELOG の MVP では、最初に次の仮説を検証する。

> 音声・自然文入力にすると、手入力よりも継続して記録できるようになるか。

この仮説検証に不要な機能は後回しにする。最初の価値は、自然文で入力し、AI が構造化候補を作り、ユーザーが確認して保存できること。

このロードマップは [system-spec.md](system-spec.md) を最新版の設計として扱う。

## 全体ロードマップ

### Phase 1: 記録を永続化できる個人アプリにする

目的:

- Vercel 上で安定して動く Next.js App Router アプリにする。
- localStorage を正式保存先から外す。
- Clerk ログイン後、Neon PostgreSQL に user / personal workspace / records を保存する。
- AI がなくても record CRUD が使える状態にする。

### Phase 2: AI 入力解析を確認フロー付きで入れる

目的:

- 自然文入力から records の構造化候補を作る。
- AI 結果を直接 DB 保存せず、ユーザー確認・修正後に保存する。
- コスト制御を最初から入れる。

### Phase 3: 数日使って入力 UX を改善する

目的:

- 記録が継続できるかを実利用で確認する。
- category / metric / unit の妥当性を見る。
- 新機能追加より、入力・確認・修正・一覧の使いやすさを改善する。

### Phase 4: 目標・期限・dashboard を追加する

目的:

- records を goals / goal_events / deadlines に接続する。
- 記録が目標達成や期限管理に役立つか検証する。

### Phase 5: 分析・共有・通知へ拡張する

目的:

- 月次レビュー、AI 分析、team workspace、招待、通知を追加する。
- MVP 1/2 で得た実データをもとに拡張する。

## Phase 1

### 実装する機能

- Vercel 向け Next.js App Router 構成の維持
- OpenAI Sites / vinext / Cloudflare 依存がない状態の確認
- Neon PostgreSQL 接続
- Drizzle ORM 導入
- migration 管理
- Clerk 認証
- 初回ログイン時の user 作成
- personal workspace 自動作成
- workspace_members owner 登録
- records の DB 保存
- record 作成
- record 一覧
- record 編集
- record 削除
- localStorage fallback の廃止
- AI なしで使える record 入力 UI

### 完了条件

- `npm run lint` が通る。
- `npm run build` が通る。
- `npm test` が通る。
- Vercel に `DATABASE_URL` / Clerk env を設定するとログインできる。
- 初回ログイン後に `users`, `workspaces`, `workspace_members` が冪等に作成される。
- record を作成すると Neon に保存される。
- リロード後も record が表示される。
- 別端末でログインしても同じ personal workspace の record が表示される。
- localStorage を消しても DB の record が残る。

### PR 単位

1. PR 1-1: Drizzle と Neon 接続基盤
   - Drizzle 導入
   - schema / migration の追加
   - DB 接続 helper
   - local dev 用 env example

2. PR 1-2: Clerk 認証の導入
   - Clerk middleware
   - sign-in / sign-up 導線
   - 認証状態の表示
   - 未ログイン時の扱い

3. PR 1-3: user / personal workspace 初期化
   - `ensureUserContext` service
   - user 作成
   - personal workspace 作成
   - workspace_members owner 作成
   - 冪等性テスト

4. PR 1-4: records CRUD API
   - GET / POST / PATCH / DELETE
   - workspace 認可
   - schema validation
   - DB transaction

5. PR 1-5: UI を DB-backed records に接続
   - localStorage 正式保存の撤去
   - record 入力
   - 一覧
   - 編集
   - 削除
   - loading / error state

### 変更するファイル

- `package.json`
- `package-lock.json`
- `.env.example`
- `drizzle.config.ts`
- `db/schema.ts`
- `db/migrations/*`
- `lib/db.ts`
- `lib/auth.ts`
- `lib/workspace-context.ts`
- `lib/records.ts`
- `app/api/records/route.ts`
- `app/api/records/[id]/route.ts`
- `middleware.ts`
- `app/layout.tsx`
- `app/page.tsx`
- `README.md`
- `docs/deployment.md`
- `tests/*`

### 追加する DB テーブル

- `users`
- `workspaces`
- `workspace_members`
- `records`

Phase 1 では `goals`, `goal_events`, `deadlines`, `ai_reviews` は追加しない。

### 追加する API

Route Handler を使う。

理由:

- Clerk 認証と workspace 認可をサーバー側で明示しやすい。
- 将来 mobile / 外部連携へ広げやすい。
- AI API も Route Handler で扱うため責務を揃えやすい。

API:

```text
GET    /api/records
POST   /api/records
PATCH  /api/records/:id
DELETE /api/records/:id
```

内部 service:

```ts
ensureUserContext(authUserId)
requireWorkspaceAccess({ authUserId, workspaceId, minimumRole })
```

### テスト項目

- 未ログイン時は record API が 401 を返す。
- 初回ログイン時に user / personal workspace / membership が作られる。
- 初回ログイン処理を複数回呼んでも重複しない。
- record 作成時に `workspace_id` と `created_by_user_id` が入る。
- record 一覧は認可済み workspace のみ返す。
- 別 workspace の record id を指定しても更新・削除できない。
- member は自分の record だけ編集・削除できる。
- build が Vercel 前提で通る。

## Phase 2

### 実装する機能

- `/api/analyze` の再設計
- AI response schema validation
- 自然文から record 候補を生成
- category / metric / value_numeric / unit / duration_minutes / value_text の抽出
- 候補確認 UI
- 候補の個別編集・削除
- 確認後に records API で保存
- 解析ボタン押下時のみ AI を呼ぶ
- 入力文字数制限
- 重複リクエスト防止
- 同一入力の短期 cache
- 低コストモデル利用
- API key はサーバーのみ
- ユーザー単位の簡易利用回数制限

### 完了条件

- 文字入力中に AI API が呼ばれない。
- 解析ボタン押下時だけ `/api/analyze` が呼ばれる。
- AI 結果は DB に直接保存されない。
- ユーザーが候補を確認・修正してから保存できる。
- 1 入力から複数 record 候補を作れる。
- AI が使えない場合も手動 record 作成は使える。
- OpenAI API key はブラウザに露出しない。

### PR 単位

1. PR 2-1: analyze API schema の再設計
   - response schema
   - validation
   - error handling
   - low-cost model default

2. PR 2-2: AI コスト制御
   - 文字数制限
   - 同一入力 cache
   - duplicate request guard
   - rate limit

3. PR 2-3: 候補確認 UI
   - records candidate list
   - edit / remove
   - save selected candidates

4. PR 2-4: 既存入力フローを AI 候補確認型へ接続
   - 現在の直接保存を撤去
   - fallback parser の位置づけ整理

### 変更するファイル

- `app/api/analyze/route.ts`
- `app/page.tsx`
- `lib/ai/analyze.ts`
- `lib/ai/schema.ts`
- `lib/ai/rate-limit.ts`
- `lib/records.ts`
- `tests/*`
- `README.md`
- `docs/deployment.md`

### 追加する DB テーブル

原則なし。

必要な場合だけ軽量 cache 用テーブルを検討するが、MVP では in-memory または短期 KV 相当を使わず、まずは request 単位の重複防止でよい。

### 追加する API

```text
POST /api/analyze
```

正式保存は Phase 1 の records API を使う。

### テスト項目

- 空入力は 400。
- 長すぎる入力は 413 または 400。
- API key 未設定時は fallback 可能なレスポンスを返す。
- AI 出力が schema 不正なら候補として採用しない。
- 同一リクエストの二重送信が UI で抑止される。
- 候補を編集して保存すると DB には編集後の値が入る。

## Phase 3

### 実装する機能

新機能追加より UX 改善を優先する。

- 入力欄の改善
- 音声入力開始/停止の状態表示
- AI 候補の修正しやすさ改善
- category の表示名・選択 UI 改善
- metric / unit の修正 UI 改善
- record 一覧の見やすさ改善
- モバイル実機での確認
- 入力成功率と修正頻度の観察

### 完了条件

- 数日間、自分で毎日記録できる。
- 入力から保存までの流れが迷わない。
- AI 候補が外れたときに直しやすい。
- よく使う category / metric の不足が洗い出されている。
- 重大なモバイル表示崩れがない。

### PR 単位

1. PR 3-1: 入力体験改善
2. PR 3-2: AI 候補編集 UI 改善
3. PR 3-3: record 一覧改善
4. PR 3-4: モバイル表示調整

### 変更するファイル

- `app/page.tsx`
- `app/globals.css`
- `components/*` を分割する場合は追加
- `lib/activity-metrics.ts`
- `tests/*`

### 追加する DB テーブル

なし。

### 追加する API

なし。既存 API の改善だけ。

### テスト項目

- モバイル幅で主要テキストが崩れない。
- 音声認識非対応ブラウザでもテキスト入力できる。
- 候補を 0 件にしても保存処理が壊れない。
- 編集中の候補を削除できる。
- record 一覧が空のときの表示が自然。

## Phase 4

### 実装する機能

- goals
- goal_events
- deadlines
- dashboard
- record から goal_event 候補を作る
- deadline 候補を作る
- goals.current_value は持たず goal_events 合計で算出

### 完了条件

- goal を作成できる。
- record 保存時に goal_event 候補を採用できる。
- goal 進捗が goal_events から算出される。
- deadline を作成・完了できる。
- dashboard に実データが表示される。

### PR 単位

1. PR 4-1: goals schema/API
2. PR 4-2: goal_events schema/API
3. PR 4-3: deadlines schema/API
4. PR 4-4: dashboard 集計
5. PR 4-5: analyze API を goals/deadlines 候補対応へ拡張

### 変更するファイル

- `db/schema.ts`
- `db/migrations/*`
- `lib/goals.ts`
- `lib/goal-events.ts`
- `lib/deadlines.ts`
- `lib/dashboard.ts`
- `app/api/goals/*`
- `app/api/deadlines/*`
- `app/api/analyze/route.ts`
- `app/page.tsx`
- `tests/*`

### 追加する DB テーブル

- `goals`
- `goal_events`
- `deadlines`

### 追加する API

```text
GET    /api/goals
POST   /api/goals
PATCH  /api/goals/:id

GET    /api/deadlines
POST   /api/deadlines
PATCH  /api/deadlines/:id
```

必要なら:

```text
POST   /api/goal-events
```

### テスト項目

- goal の現在値が goal_events 合計と一致する。
- 負の delta_value で補正できる。
- record 削除時に goal_event の扱いが仕様通り。
- deadline の due_date / due_at が timezone と矛盾しない。
- workspace 認可漏れがない。

## Phase 5

### 実装する機能

- 月次レビュー
- AI 分析
- team workspace
- 招待
- role 管理
- 通知

### 完了条件

- 対象期間の月次レビューを生成できる。
- 同じ input_hash のレビューを再利用できる。
- team workspace にメンバーを招待できる。
- role に応じて編集権限が変わる。
- 通知方針が決まり、最低 1 種類の通知が動く。

### PR 単位

1. PR 5-1: ai_reviews schema/API
2. PR 5-2: 月次レビュー生成と cache
3. PR 5-3: team workspace 作成
4. PR 5-4: 招待・membership 管理
5. PR 5-5: 通知方式の最小実装

### 変更するファイル

- `db/schema.ts`
- `db/migrations/*`
- `lib/monthly-review.ts`
- `lib/workspaces.ts`
- `lib/invitations.ts`
- `lib/notifications.ts`
- `app/api/monthly-review/route.ts`
- `app/api/workspaces/*`
- `app/api/invitations/*`
- `tests/*`

### 追加する DB テーブル

- `ai_reviews`
- `workspace_invitations`
- 通知方式に応じて `notifications` または `notification_deliveries`

### 追加する API

```text
POST /api/monthly-review
GET  /api/monthly-review

GET  /api/workspaces
POST /api/workspaces
PATCH /api/workspaces/:id

POST /api/invitations
POST /api/invitations/:id/accept
```

通知 API は方式決定後に追加する。

### テスト項目

- ai_reviews の input_hash が変わると再生成できる。
- 同じ input_hash は再利用される。
- viewer は編集できない。
- member は他人の record を編集できない。
- 招待された user だけ workspace に参加できる。

## 想定リスク

- Clerk と自前 workspace の user 同期で不整合が出る。
- Neon 接続数が serverless 環境で増えすぎる。
- Drizzle migration と本番 DB の状態がずれる。
- 既存 prototype の localStorage データが DB へ移行されない。
- AI 候補確認 UI が面倒で、入力継続の妨げになる。
- AI コストが想定より増える。
- category / metric 設計が早期に不足する。
- 音声認識のブラウザ差で体験が不安定になる。
- workspace_id 認可漏れが起きる。
- MVP に goals/deadlines を早く入れすぎて、最重要仮説の検証が遅れる。

## 最初の 1 週間

### Day 1

- Drizzle / Neon 方針を確定。
- `.env.example` を追加。
- Drizzle schema の最小 4 テーブルを作る。
- migration を生成。
- `npm run build` が通るところまで確認。

### Day 2

- Clerk を導入。
- middleware を追加。
- 未ログイン/ログイン済みの画面状態を作る。
- Vercel env に Clerk key を入れて動作確認。

### Day 3

- `ensureUserContext` を実装。
- 初回ログイン時に user / personal workspace / membership を作る。
- 冪等性をテスト。

### Day 4

- records API を実装。
- GET / POST を先に入れる。
- workspace 認可と created_by_user_id を入れる。

### Day 5

- records PATCH / DELETE を追加。
- member は自分の record だけ編集・削除できるルールを実装。
- API テストを追加。

### Day 6

- UI を DB-backed records に接続。
- localStorage 正式保存を撤去。
- record 作成・一覧・削除を実機確認。

### Day 7

- record 編集 UI を追加。
- モバイルで入力から保存まで確認。
- Phase 2 に入る前に UX と schema の違和感を整理。

## 今すぐ実装を始めるべき PR

最初の PR はこれにする。

### PR 1-1: Drizzle と Neon 接続基盤

範囲:

- `drizzle-orm` / `drizzle-kit` の導入
- `drizzle.config.ts` 追加
- `db/schema.ts` 追加
- `users`, `workspaces`, `workspace_members`, `records` の schema 定義
- 初期 migration 追加
- `lib/db.ts` 追加
- `.env.example` 追加
- README に Neon / Drizzle の最小セットアップ追記

この PR では Clerk 認証も UI 変更も入れない。

理由:

- 小さく安全。
- レビューしやすい。
- DB 構造を先に固定できる。
- 後続の Clerk / records API がこの土台に乗る。
