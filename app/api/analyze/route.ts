export const runtime = "nodejs";

type AnalyzedRecord = {
  category: string;
  title: string;
  value: string;
  time: string;
};

const categories = ["仕事", "健康", "食事", "期限", "目標", "メモ"] as const;

const recordSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    records: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: categories },
          title: { type: "string" },
          value: { type: "string" },
          time: { type: "string" },
        },
        required: ["category", "title", "value", "time"],
      },
    },
  },
  required: ["records"],
};

function unavailable(message: string) {
  return Response.json(
    {
      error: message,
      fallback: "local-parser",
    },
    { status: 503 },
  );
}

function normalizeRecord(record: AnalyzedRecord): AnalyzedRecord {
  return {
    category: categories.includes(record.category as (typeof categories)[number]) ? record.category : "メモ",
    title: record.title.trim() || "記録",
    value: record.value.trim() || "記録済み",
    time: record.time.trim() || new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }),
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return unavailable("OPENAI_API_KEY is not configured.");

  const payload = (await request.json()) as { text?: string };
  const text = payload.text?.trim();
  if (!text) {
    return Response.json({ error: "text is required." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const now = new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "あなたは生活ログを構造化するアシスタントです。日本語の自然文を、仕事・健康・食事・期限・目標・メモの記録に分割してください。value には時間、進捗、kg、期限など定量情報を優先して入れ、なければ 記録済み としてください。",
        },
        {
          role: "user",
          content: `現在時刻は ${now} です。次の入力を生活ログに構造化してください。\n\n${text}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "koelog_records",
          strict: true,
          schema: recordSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    return unavailable(`OpenAI API request failed with status ${response.status}.`);
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = result.choices?.[0]?.message?.content;
  if (!content) return unavailable("OpenAI API returned no structured content.");

  const parsed = JSON.parse(content) as { records?: AnalyzedRecord[] };
  return Response.json({
    records: (parsed.records ?? []).map(normalizeRecord),
  });
}
