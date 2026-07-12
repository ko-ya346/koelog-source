"use client";

import { useEffect, useMemo, useState } from "react";
import { calculateActivityMetrics } from "@/lib/activity-metrics";

type Log = { id: number; category: string; title: string; value: string; time: string };
type CoachAdvice = { title: string; body: string };
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

const samples: Log[] = [
  { id: 1, category: "仕事", title: "世界環境サミット資料", value: "2時間・進捗70%", time: "14:20" },
  { id: 2, category: "健康", title: "体重", value: "72.4 kg", time: "08:10" },
  { id: 3, category: "食事", title: "朝食", value: "トースト、卵、コーヒー", time: "08:15" },
];
const defaultCoachAdvice: CoachAdvice = {
  title: "明日は、朝の30分を制作に使いましょう。",
  body: "午前中に制作した日は、目標進捗が平均22%高くなっています。9:00から30分確保すると、今月のペースに戻れます。",
};

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
    return { id: Date.now() + i, category, title: part, value, time: now };
  });
}

async function analyzeText(text: string): Promise<Log[]> {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) throw new Error("AI analysis unavailable");

  const payload = (await response.json()) as { records?: Omit<Log, "id">[] };
  return (payload.records ?? []).map((record, index) => ({
    id: Date.now() + index,
    ...record,
  }));
}

export default function Home() {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [logs, setLogs] = useState<Log[]>(samples);
  const [coachAdvice, setCoachAdvice] = useState<CoachAdvice>(defaultCoachAdvice);

  useEffect(() => {
    fetch("/api/bootstrap", { method: "POST" }).catch(() => {
      // Keep the prototype usable when Clerk or the database is not configured.
    });
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadRecords() {
      try {
        const response = await fetch("/api/records");
        if (response.ok) {
          const payload = (await response.json()) as { records?: Log[] };
          if (!ignore && payload.records && payload.records.length > 0) {
            setLogs(payload.records);
            return;
          }
        }
      } catch {
        // Keep the prototype usable without a configured database.
      }

      const saved = localStorage.getItem("koelog-records");
      if (!ignore && saved) setLogs(JSON.parse(saved) as Log[]);
    }

    loadRecords();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("koelog-records", JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    let ignore = false;

    async function loadAdvice() {
      try {
        const response = await fetch("/api/monthly-review", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ logs }),
        });
        if (!response.ok) return;

        const advice = (await response.json()) as CoachAdvice;
        if (!ignore && advice.title && advice.body) setCoachAdvice(advice);
      } catch {
        // Keep the existing static advice when AI review is unavailable.
      }
    }

    loadAdvice();
    return () => {
      ignore = true;
    };
  }, [logs]);

  const metrics = useMemo(() => calculateActivityMetrics(logs), [logs]);

  async function save() {
    if (!text.trim()) return;
    let parsed: Log[];
    try {
      parsed = await analyzeText(text);
      if (parsed.length === 0) parsed = parseVoice(text);
    } catch {
      parsed = parseVoice(text);
    }

    try {
      const response = await fetch("/api/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ records: parsed }),
      });

      if (response.ok) {
        const payload = (await response.json()) as { records?: Log[] };
        setLogs((prev) => [...(payload.records ?? parsed), ...prev]);
      } else {
        setLogs((prev) => [...parsed, ...prev]);
      }
    } catch {
      setLogs((prev) => [...parsed, ...prev]);
    }
    setText("");
  }

  async function resetRecords() {
    try {
      await fetch("/api/records", { method: "DELETE" });
    } catch {
      // localStorage reset below is enough when the API is unavailable.
    }
    localStorage.removeItem("koelog-records");
    setLogs(samples);
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
      <header className="topbar">
        <div className="brand"><span className="brandmark">声</span><strong>KOELOG</strong></div>
        <div className="date">2026年7月11日（土）</div>
        <button className="avatar" aria-label="プロフィール">K</button>
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
          <button className="save" onClick={save}>AIで整理して記録</button>
          <small>記録はこの端末内だけに保存されます</small>
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
            <div className="panelHead"><h3>今日の記録</h3><button onClick={resetRecords}>リセット</button></div>
            <div className="timeline">
              {logs.map((log) => <div className="log" key={log.id}><time>{log.time}</time><span className={`tag ${log.category}`}>{log.category}</span><div><strong>{log.title}</strong><p>{log.value}</p></div></div>)}
            </div>
          </section>
          <aside>
            <section className="coach">
              <p className="eyebrow">AI COACH</p><h3>{coachAdvice.title}</h3>
              <p>{coachAdvice.body}</p>
              <button>予定に追加する</button>
            </section>
            <section className="deadlines"><div className="panelHead"><h3>期限・支払い</h3><span>2件</span></div><p><b>7/20</b> 電気代の支払い</p><p><b>7/25</b> 旅行代金の振込</p></section>
          </aside>
        </div>
      </section>
    </main>
  );
}
