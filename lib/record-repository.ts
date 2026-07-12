import { and, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/db/client";
import { records } from "@/db/schema";
import type { ValidatedRecordInput, ValidatedRecordUpdate } from "@/lib/record-validation";

export type RecordRow = typeof records.$inferSelect;

export async function listRecordRows({ workspaceId, limit = 100 }: { workspaceId: string; limit?: number }) {
  return db
    .select()
    .from(records)
    .where(and(eq(records.workspaceId, workspaceId), isNull(records.deletedAt)))
    .orderBy(desc(records.occurredAt), desc(records.createdAt))
    .limit(limit);
}

export async function insertRecordRows({
  workspaceId,
  createdByUserId,
  inputs,
}: {
  workspaceId: string;
  createdByUserId: string;
  inputs: ValidatedRecordInput[];
}) {
  if (inputs.length === 0) return [];

  return db
    .insert(records)
    .values(
      inputs.map((input) => ({
        workspaceId,
        createdByUserId,
        category: input.category,
        title: input.title,
        sourceText: input.sourceText,
        metric: input.metric,
        valueNumeric: input.valueNumeric,
        unit: input.unit,
        durationMinutes: input.durationMinutes,
        valueText: input.valueText,
        occurredAt: input.occurredAt,
      })),
    )
    .returning();
}

export async function updateRecordRow({
  id,
  workspaceId,
  createdByUserId,
  input,
}: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
  input: ValidatedRecordUpdate;
}) {
  const [row] = await db
    .update(records)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(records.id, id),
        eq(records.workspaceId, workspaceId),
        eq(records.createdByUserId, createdByUserId),
        isNull(records.deletedAt),
      ),
    )
    .returning();

  return row ?? null;
}

export async function softDeleteRecordRow({
  id,
  workspaceId,
  createdByUserId,
}: {
  id: string;
  workspaceId: string;
  createdByUserId: string;
}) {
  const now = new Date();
  const [row] = await db
    .update(records)
    .set({
      deletedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(records.id, id),
        eq(records.workspaceId, workspaceId),
        eq(records.createdByUserId, createdByUserId),
        isNull(records.deletedAt),
      ),
    )
    .returning();

  return row ?? null;
}
