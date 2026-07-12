import { auth } from "@clerk/nextjs/server";

import { createRecordsForAuthUser, listRecordsForAuthUser } from "@/lib/records";
import { parseCreateRecordsPayload, ValidationError } from "@/lib/record-validation";

export const runtime = "nodejs";

async function requireAuthUserId() {
  const { userId } = await auth();
  return userId;
}

function handleError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[records] Request failed.", error);
  return Response.json({ error: "Record request failed." }, { status: 500 });
}

export async function GET() {
  const authUserId = await requireAuthUserId();
  if (!authUserId) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const records = await listRecordsForAuthUser(authUserId);
    return Response.json({ records });
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: Request) {
  const authUserId = await requireAuthUserId();
  if (!authUserId) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const payload = await request.json();
    const records = parseCreateRecordsPayload(payload);
    const created = await createRecordsForAuthUser(authUserId, records);
    return Response.json({ records: created }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE() {
  return Response.json({ error: "Bulk record delete is not supported." }, { status: 405 });
}
