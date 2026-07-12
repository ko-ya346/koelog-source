import { createRecords, deleteRecords, listRecords, type NewRecordItem } from "@/lib/records";

export const runtime = "nodejs";

function unavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "Database unavailable.";

  return Response.json(
    {
      error: message,
      fallback: "localStorage",
    },
    { status: 503 },
  );
}

function isRecord(value: unknown): value is NewRecordItem {
  if (!value || typeof value !== "object") return false;

  const item = value as Partial<NewRecordItem>;
  return (
    typeof item.category === "string" &&
    typeof item.title === "string" &&
    typeof item.value === "string" &&
    typeof item.time === "string"
  );
}

export async function GET() {
  try {
    const records = await listRecords();
    return Response.json({ records });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { records?: unknown };
    const records = Array.isArray(payload.records) ? payload.records : [];

    if (!records.every(isRecord)) {
      return Response.json({ error: "records must be an array of record items." }, { status: 400 });
    }

    const created = await createRecords(records);
    return Response.json({ records: created }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}

export async function DELETE() {
  try {
    await deleteRecords();
    return Response.json({ ok: true });
  } catch (error) {
    return unavailable(error);
  }
}
