"use client";

import { Show, SignInButton, SignUpButton, UserButton, useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { calculateActivityMetrics } from "@/lib/activity-metrics";

type Log = {
  id: string;
  category: string;
  title: string;
  value: string;
  time: string;
  sourceText?: string | null;
  metric?: string | null;
  valueNumeric?: string | null;
  valueText?: string | null;
  unit?: string | null;
  durationMinutes?: number | null;
  occurredAt?: string;
};
type EditDraft = { category: string; title: string; value: string };
type CoachAdvice = { title: string; body: string };
type DeadlineItem = { label: string; title: string };
type VoiceRecognitionResultEvent = {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};
type VoiceRecognition = {
  lang: string;
  interimResults: boolean;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: VoiceRecognitionResultEvent) => void) | null;
  start: () => void;
};
type VoiceRecognitionConstructor = new () => VoiceRecognition;

declare global {
  interface Window {
    SpeechRecognition?: VoiceRecognitionConstructor;
    webkitSpeechRecognition?: VoiceRecognitionConstructor;
  }
}

const defaultCoachAdvice: CoachAdvice = {
  title: "明日は、朝の30分を制作に使いましょう。",
  body: "午前中に制作した日は、目標進捗が平均22%高くなっています。9:00から30分確保すると、今月のペースに戻れます。",
};

function extractDeadline(log: Log): DeadlineItem | null {
  const value = `${log.title} ${log.value}`;
  if (log.category !== "期限" && !/支払|期限|締切|までに|振込/.test(value)) return null;

  const monthDay = value.match(/(\d{1,2})[\/月](\d{1,2})日?/);
  const dayOnly = value.match(/(\d{1,2})日(?:まで|締切|支払|振込)?/);
  const label = monthDay
    ? `${Number(monthDay[1])}/${Number(monthDay[2])}`
    : dayOnly
      ? `${Number(dayOnly[1])}日`
      : "期限";

  return { label, title: log.title };
}

function extractDeadlines(logs: Log[]) {
  return logs
    .map(extractDeadline)
    .filter((deadline): deadline is DeadlineItem => deadline !== null);
}

function parseVoice(text: string): Log[] {
  const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
  const parts = text.split(/[。\n]/).map((x) => x.trim()).filter(Boolean);
  return parts.map((part, i) => {
    let category = "メモ";
    if (/体重|睡眠|散歩|運動|体調/.test(part)) category = "健康";
    else if (/食べ|朝食|昼食|夕食|ごはん|ラーメン/.test(part)) category = "食事";
    else if (/支払|期限|までに|振込/.test(part)) category = "期限";
    else if (/仕事|会議|作業|制作|記事|資料/.test(part)) category = "仕事";
    else if (/目標|進捗|達成/.test(part)) category = "目標";
    const value = part.match(/\d+(?:\.\d+)?(?:キロ|kg|時間|分|%|割)/i)?.[0] ?? "記録済み";
    return { id: `draft-${Date.now()}-${i}`, category, title: part, value, sourceText: part, time: now };
  });
}

function BootstrapOnSignIn({ onReady }: { onReady: () => void }) {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;

    fetch("/api/bootstrap", { method: "POST" })
      .then((response) => {
        if (!response.ok) {
          console.warn("KOELOG bootstrap failed", { status: response.status });
          return;
        }
        onReady();
      })
      .catch((error: unknown) => {
        console.warn("KOELOG bootstrap request failed", error);
      });
  }, [isLoaded, isSignedIn, onReady]);

  return null;
}

export default function Home() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [logs, setLogs] = useState<Log[]>([]);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice>(defaultCoachAdvice);
  const [loadingRecords, setLoadingRecords] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ category: "メモ", title: "", value: "" });
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  const loadRecords = useCallback(async () => {
    await Promise.resolve();
    setLoadingRecords(true);
    setRecordError(null);
    try {
      const response = await fetch("/api/records", { cache: "no-store" });
      if (response.status === 401) {
        setLogs([]);
        setRecordError("ログインすると記録を表示できます。");
        return;
      }
      if (!response.ok) throw new Error("Failed to load records.");

      const payload = (await response.json()) as { records?: Log[] };
      setLogs(payload.records ?? []);
    } catch {
      setRecordError("記録を読み込めませんでした。時間をおいて再度お試しください。");
    } finally {
      setLoadingRecords(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const metrics = useMemo(() => calculateActivityMetrics(logs), [logs]);
  const deadlines = useMemo(() => extractDeadlines(logs), [logs]);

  async function save() {
    if (!text.trim() || saving) return;
    const parsed = parseVoice(text);
    if (parsed.length === 0) return;

    setSaving(true);
    setRecordError(null);
    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ records: parsed }),
      });

      if (!response.ok) throw new Error("Failed to save records.");

      const payload = (await response.json()) as { records?: Log[] };
      setLogs((prev) => [...(payload.records ?? []), ...prev]);
      setText("");
    } catch {
      setRecordError("記録を保存できませんでした。ログイン状態と通信状況を確認してください。");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(log: Log) {
    setEditingId(log.id);
    setEditDraft({ category: log.category, title: log.title, value: log.value });
    setRecordError(null);
  }

  async function updateRecord() {
    if (!editingId || mutatingId) return;
    setMutatingId(editingId);
    setRecordError(null);

    try {
      const response = await fetch(`/api/records/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editDraft),
      });

      if (!response.ok) throw new Error("Failed to update record.");

      const payload = (await response.json()) as { record?: Log };
      if (payload.record) {
        setLogs((prev) => prev.map((log) => (log.id === payload.record?.id ? payload.record : log)));
      }
      setEditingId(null);
    } catch {
      setRecordError("記録を更新できませんでした。");
    } finally {
      setMutatingId(null);
    }
  }

  async function deleteRecord(log: Log) {
    if (mutatingId) return;
    if (!window.confirm("この記録を削除しますか？")) return;

    setMutatingId(log.id);
    setRecordError(null);
    try {
      const response = await fetch(`/api/records/${log.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete record.");
      setLogs((prev) => prev.filter((item) => item.id !== log.id));
      if (editingId === log.id) setEditingId(null);
    } catch {
      setRecordError("記録を削除できませんでした。");
    } finally {
      setMutatingId(null);
    }
  }

  async function runMonthlyReview() {
    if (reviewing) return;

    setReviewing(true);
    setRecordError(null);
    try {
      const response = await fetch("/api/monthly-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ logs }),
      });
      if (!response.ok) throw new Error("Failed to run monthly review.");

      const advice = (await response.json()) as CoachAdvice;
      if (advice.title && advice.body) setCoachAdvice(advice);
    } catch {
      setRecordError("月次レビューを実行できませんでした。");
    } finally {
      setReviewing(false);
    }
  }

  function startVoice() {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { alert("このブラウザでは音声入力を利用できません。文字入力でお試しください。"); return; }
    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event) => setText((v) => `${v}${v ? "。" : ""}${event.results[0][0].transcript}`);
    recognition.start();
  }

  return (
    <main>
      {hasClerk ? <BootstrapOnSignIn onReady={loadRecords} /> : null}
      <header className="topbar">
        <div className="brand"><span className="brandmark">声</span><strong>KOELOG</strong></div>
        <div className="date">2026年7月11日（土）</div>
        {hasClerk ? (
          <div className="authControls">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button className="authButton">ログイン</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="authButton primary">登録</button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        ) : (
          <button className="avatar" aria-label="プロフィール">K</button>
        )}
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">VOICE LIFE ASSISTANT</p>
          <h1>話すだけで、<br />今日が整う。</h1>
          <p className="lead">健康、仕事、目標、支払い期限。あなたの言葉を、次の行動に変える生活ログ。</p>
        </div>
        <div className="voiceCard">
          <button className={`mic ${listening ? "active" : ""}`} onClick={startVoice} aria-label="音声入力を開始">●</button>
          <div><strong>{listening ? "聞いています…" : "今日のことを話してください"}</strong><span>クリックして音声入力</span></div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="例：体重72.4キロ。記事を2時間書いて、進捗は半分。電気代は20日まで。" />
          <button className="save" onClick={save} disabled={saving || !text.trim()}>{saving ? "保存中…" : "記録する"}</button>
          <small>記録はログイン中のアカウントに保存されます</small>
        </div>
      </section>

      <section className="dashboard">
        <div className="sectionTitle"><div><p className="eyebrow">TODAY</p><h2>今日のまとめ</h2></div><span className="status">順調なペース</span></div>
        <div className="stats">
          <article><span>仕事</span><strong>{Math.floor(metrics.workMinutes / 60)}<small>時間</small></strong><em>目標 6時間</em></article>
          <article><span>目標達成率</span><strong>{metrics.goalProgress ?? 0}<small>%</small></strong><em>記録から自動集計</em></article>
          <article><span>健康</span><strong>{metrics.latestWeightKg ?? "--"}<small>kg</small></strong><em>最新の健康記録</em></article>
          <article className="warning"><span>未完了の期限</span><strong>{metrics.deadlineCount}<small>件</small></strong><em>記録から自動抽出</em></article>
        </div>

        <div className="contentGrid">
          <section className="panel">
            <div className="panelHead"><h3>今日の記録</h3></div>
            {recordError ? <p className="recordError">{recordError}</p> : null}
            <div className="timeline">
              {loadingRecords ? <p className="recordState">記録を読み込んでいます…</p> : null}
              {!loadingRecords && logs.length === 0 ? <p className="recordState">まだ記録がありません。</p> : null}
              {logs.map((log) => (
                <div className="log" key={log.id}>
                  <time>{log.time}</time>
                  <span className={`tag ${log.category}`}>{log.category}</span>
                  {editingId === log.id ? (
                    <div className="recordEdit">
                      <select
                        value={editDraft.category}
                        onChange={(event) => setEditDraft((draft) => ({ ...draft, category: event.target.value }))}
                      >
                        {["仕事", "健康", "食事", "学習", "制作", "家事", "メモ", "その他"].map((category) => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                      <input
                        value={editDraft.title}
                        onChange={(event) => setEditDraft((draft) => ({ ...draft, title: event.target.value }))}
                        aria-label="記録タイトル"
                      />
                      <input
                        value={editDraft.value}
                        onChange={(event) => setEditDraft((draft) => ({ ...draft, value: event.target.value }))}
                        aria-label="記録値"
                      />
                      <div className="recordActions">
                        <button onClick={updateRecord} disabled={mutatingId === log.id}>保存</button>
                        <button onClick={() => setEditingId(null)} disabled={mutatingId === log.id}>キャンセル</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <strong>{log.title}</strong>
                      <p>{log.value}</p>
                      <div className="recordActions">
                        <button onClick={() => startEdit(log)} disabled={mutatingId === log.id}>編集</button>
                        <button onClick={() => deleteRecord(log)} disabled={mutatingId === log.id}>削除</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
          <aside>
            <section className="coach">
              <p className="eyebrow">AI COACH</p><h3>{coachAdvice.title}</h3>
              <p>{coachAdvice.body}</p>
              <button onClick={runMonthlyReview} disabled={reviewing}>{reviewing ? "実行中…" : "月次レビュー"}</button>
            </section>
            <section className="deadlines">
              <div className="panelHead"><h3>期限・支払い</h3><span>{deadlines.length}件</span></div>
              {deadlines.map((deadline) => <p key={`${deadline.label}-${deadline.title}`}><b>{deadline.label}</b> {deadline.title}</p>)}
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
