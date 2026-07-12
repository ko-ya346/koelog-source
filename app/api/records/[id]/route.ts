import { auth } from "@clerk/nextjs/server";

import { deleteRecordForAuthUser, updateRecordForAuthUser } from "@/lib/records";
import { assertRecordId, parseRecordUpdatePayload, ValidationError } from "@/lib/record-validation";

export const runtime = "nodejs";

async function requireAuthUserId() {
  const { userId } = await auth();
  return userId;
}

function handleError(error: unknown) {
  if (error instanceof ValidationError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error("[records] Record mutation failed.", error);
  return Response.json({ error: "Record request failed." }, { status: 500 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const authUserId = await requireAuthUserId();
  if (!authUserId) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const { id } = await context.params;
    assertRecordId(id);
    const input = parseRecordUpdatePayload(await request.json());
    const record = await updateRecordForAuthUser({ authUserId, recordId: id, input });

    if (!record) return Response.json({ error: "Record not found." }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const authUserId = await requireAuthUserId();
  if (!authUserId) return Response.json({ error: "Authentication required." }, { status: 401 });

  try {
    const { id } = await context.params;
    assertRecordId(id);
    const record = await deleteRecordForAuthUser({ authUserId, recordId: id });

    if (!record) return Response.json({ error: "Record not found." }, { status: 404 });
    return Response.json({ record });
  } catch (error) {
    return handleError(error);
  }
}
