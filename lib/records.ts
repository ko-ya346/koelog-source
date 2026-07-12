import { ensurePersonalWorkspaceForAuthUser } from "@/lib/workspace-bootstrap";
import {
  insertRecordRows,
  listRecordRows,
  softDeleteRecordRow,
  updateRecordRow,
  type RecordRow,
} from "@/lib/record-repository";
import type { ValidatedRecordInput, ValidatedRecordUpdate } from "@/lib/record-validation";

export type RecordItem = {
  id: string;
  category: string;
  title: string;
  value: string;
  time: string;
  sourceText: string | null;
  metric: string | null;
  valueNumeric: string | null;
  valueText: string | null;
  unit: string | null;
  durationMinutes: number | null;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

const categoryLabels: Record<string, string> = {
  work: "仕事",
  health: "健康",
  meal: "食事",
  learning: "学習",
  creation: "制作",
  household: "家事",
  memo: "メモ",
  other: "その他",
};

async function requirePersonalWorkspace(authUserId: string) {
  return ensurePersonalWorkspaceForAuthUser({ authUserId });
}

function displayValue(row: RecordRow) {
  if (row.valueText) return row.valueText;
  if (row.durationMinutes != null) return `${row.durationMinutes}分`;
  if (row.valueNumeric != null && row.unit) return `${row.valueNumeric} ${row.unit}`;
  if (row.valueNumeric != null) return row.valueNumeric;
  return "記録済み";
}

function displayTime(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    category: categoryLabels[row.category] ?? "その他",
    title: row.title,
    value: displayValue(row),
    time: displayTime(row.occurredAt),
    sourceText: row.sourceText,
    metric: row.metric,
    valueNumeric: row.valueNumeric,
    valueText: row.valueText,
    unit: row.unit,
    durationMinutes: row.durationMinutes,
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listRecordsForAuthUser(authUserId: string) {
  const context = await requirePersonalWorkspace(authUserId);
  const rows = await listRecordRows({ workspaceId: context.workspaceId, limit: 100 });
  return rows.map(mapRecord);
}

export async function createRecordsForAuthUser(authUserId: string, inputs: ValidatedRecordInput[]) {
  const context = await requirePersonalWorkspace(authUserId);
  const rows = await insertRecordRows({
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    inputs,
  });
  return rows.map(mapRecord);
}

export async function updateRecordForAuthUser({
  authUserId,
  recordId,
  input,
}: {
  authUserId: string;
  recordId: string;
  input: ValidatedRecordUpdate;
}) {
  const context = await requirePersonalWorkspace(authUserId);
  const row = await updateRecordRow({
    id: recordId,
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
    input,
  });
  return row ? mapRecord(row) : null;
}

export async function deleteRecordForAuthUser({ authUserId, recordId }: { authUserId: string; recordId: string }) {
  const context = await requirePersonalWorkspace(authUserId);
  const row = await softDeleteRecordRow({
    id: recordId,
    workspaceId: context.workspaceId,
    createdByUserId: context.userId,
  });
  return row ? mapRecord(row) : null;
}
