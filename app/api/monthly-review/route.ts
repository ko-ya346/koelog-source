export const runtime = "nodejs";

type ReviewLog = {
  category: string;
  title: string;
  value: string;
  time: string;
};

const reviewSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    body: { type: "string" },
  },
  required: ["title", "body"],
};

function unavailable(message: string) {
  return Response.json(
    {
      error: message,
      fallback: "static-coach",
    },
    { status: 503 },
  );
}

function isReviewLog(value: unknown): value is ReviewLog {
  if (!value || typeof value !== "object") return false;
  const log = value as Partial<ReviewLog>;
  return (
    typeof log.category === "string" &&
    typeof log.title === "string" &&
    typeof log.value === "string" &&
    typeof log.time === "string"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return unavailable("OPENAI_API_KEY is not configured.");

  const payload = (await request.json()) as { logs?: unknown };
  const logs = Array.isArray(payload.logs) ? payload.logs : [];
  if (!logs.every(isReviewLog)) {
    return Response.json({ error: "logs must be an array of log items." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  const compactLogs = logs.slice(0, 80).map((log) => ({
    category: log.category,
    title: log.title,
    value: log.value,
    time: log.time,
  }));

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
            "あなたは生活ログをもとに短い月次レビューを作るAI秘書です。ユーザーが次に取る行動が分かるように、具体的で短い日本語で返してください。",
        },
        {
          role: "user",
          content: `以下の記録をもとに、月次の振り返りアドバイスを作ってください。title は一文、body は120文字以内にしてください。\n\n${JSON.stringify(compactLogs, null, 2)}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "koelog_monthly_review",
          strict: true,
          schema: reviewSchema,
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
  if (!content) return unavailable("OpenAI API returned no review content.");

  const review = JSON.parse(content) as { title?: string; body?: string };
  return Response.json({
    title: review.title?.trim() || "今月の行動を整えましょう。",
    body: review.body?.trim() || "記録を続けるほど、次に集中すべき行動が見えやすくなります。",
  });
}
