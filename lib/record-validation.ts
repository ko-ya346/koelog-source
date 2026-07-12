export const recordCategories = [
  "work",
  "health",
  "meal",
  "learning",
  "creation",
  "household",
  "memo",
  "other",
] as const;

export type RecordCategory = (typeof recordCategories)[number];

export type ValidatedRecordInput = {
  category: RecordCategory;
  title: string;
  sourceText: string | null;
  metric: string | null;
  valueNumeric: string | null;
  unit: string | null;
  durationMinutes: number | null;
  valueText: string | null;
  occurredAt: Date;
};

export type ValidatedRecordUpdate = Partial<ValidatedRecordInput>;

const categoryAliases: Record<string, RecordCategory> = {
  work: "work",
  health: "health",
  meal: "meal",
  learning: "learning",
  creation: "creation",
  household: "household",
  memo: "memo",
  other: "other",
  "仕事": "work",
  "健康": "health",
  "食事": "meal",
  "学習": "learning",
  "制作": "creation",
  "家事": "household",
  "メモ": "memo",
  "その他": "other",
  "期限": "memo",
  "目標": "memo",
};

export class ValidationError extends Error {
  status = 400;
}

function fail(message: string): never {
  throw new ValidationError(message);
}

function asObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("record must be an object.");
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, key: string, options?: { required?: boolean; max?: number }) {
  const value = record[key];
  if (value == null) {
    if (options?.required) fail(`${key} is required.`);
    return null;
  }
  if (typeof value !== "string") fail(`${key} must be a string.`);

  const trimmed = value.trim();
  if (!trimmed) {
    if (options?.required) fail(`${key} is required.`);
    return null;
  }
  if (options?.max && trimmed.length > options.max) fail(`${key} is too long.`);
  return trimmed;
}

function numericField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isFinite(numeric)) fail(`${key} must be numeric.`);
  return String(numeric);
}

function integerField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value == null || value === "") return null;
  const numeric = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(numeric) || numeric < 0) fail(`${key} must be a non-negative integer.`);
  return numeric;
}

function dateField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (value == null || value === "") return new Date();
  if (typeof value !== "string") fail(`${key} must be an ISO date string.`);

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`${key} must be a valid date.`);
  return date;
}

function normalizeCategory(value: string | null) {
  if (!value) return "memo";
  return categoryAliases[value] ?? "other";
}

function inferMetricFields({
  category,
  title,
  valueText,
}: {
  category: RecordCategory;
  title: string;
  valueText: string | null;
}) {
  const text = `${title} ${valueText ?? ""}`;
  const hours = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:時間|h|hour)/gi)].reduce(
    (total, match) => total + Number(match[1]) * 60,
    0,
  );
  const minutes = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(?:分|m|min|minute)/gi)].reduce(
    (total, match) => total + Number(match[1]),
    0,
  );
  const durationMinutes = Math.round(hours + minutes);
  if (durationMinutes > 0) {
    return {
      metric: category === "work" ? "work_duration" : "duration",
      valueNumeric: null,
      unit: "minute",
      durationMinutes,
    };
  }

  const weight = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|キロ)/i);
  if (weight) {
    return {
      metric: "body_weight",
      valueNumeric: String(Number(weight[1])),
      unit: "kg",
      durationMinutes: null,
    };
  }

  const distance = text.match(/(\d+(?:\.\d+)?)\s*(?:km|キロメートル)/i);
  if (distance) {
    return {
      metric: "running_distance",
      valueNumeric: String(Number(distance[1])),
      unit: "km",
      durationMinutes: null,
    };
  }

  return {
    metric: null,
    valueNumeric: null,
    unit: null,
    durationMinutes: null,
  };
}

export function parseRecordInput(value: unknown): ValidatedRecordInput {
  const record = asObject(value);
  const title = stringField(record, "title", { required: true, max: 200 })!;
  const valueText = stringField(record, "valueText", { max: 500 }) ?? stringField(record, "value", { max: 500 });
  const category = normalizeCategory(stringField(record, "category", { max: 40 }));
  const inferred = inferMetricFields({ category, title, valueText });

  return {
    category,
    title,
    sourceText: stringField(record, "sourceText", { max: 2000 }) ?? title,
    metric: stringField(record, "metric", { max: 100 }) ?? inferred.metric,
    valueNumeric: numericField(record, "valueNumeric") ?? inferred.valueNumeric,
    unit: stringField(record, "unit", { max: 40 }) ?? inferred.unit,
    durationMinutes: integerField(record, "durationMinutes") ?? inferred.durationMinutes,
    valueText: valueText ?? "記録済み",
    occurredAt: dateField(record, "occurredAt"),
  };
}

export function parseCreateRecordsPayload(payload: unknown) {
  const body = asObject(payload);
  const items = body.records;
  if (!Array.isArray(items)) fail("records must be an array.");
  if (items.length > 10) fail("records must contain 10 items or fewer.");
  return items.map(parseRecordInput);
}

export function parseRecordUpdatePayload(payload: unknown): ValidatedRecordUpdate {
  const record = asObject(payload);
  const update: ValidatedRecordUpdate = {};

  if ("category" in record) update.category = normalizeCategory(stringField(record, "category", { max: 40 }));
  if ("title" in record) update.title = stringField(record, "title", { required: true, max: 200 })!;
  if ("sourceText" in record) update.sourceText = stringField(record, "sourceText", { max: 2000 });
  if ("metric" in record) update.metric = stringField(record, "metric", { max: 100 });
  if ("valueNumeric" in record) update.valueNumeric = numericField(record, "valueNumeric");
  if ("unit" in record) update.unit = stringField(record, "unit", { max: 40 });
  if ("durationMinutes" in record) update.durationMinutes = integerField(record, "durationMinutes");
  if ("valueText" in record || "value" in record) {
    update.valueText =
      stringField(record, "valueText", { max: 500 }) ?? stringField(record, "value", { max: 500 }) ?? "記録済み";
  }
  if ("occurredAt" in record) update.occurredAt = dateField(record, "occurredAt");

  if (Object.keys(update).length === 0) fail("record update must contain at least one field.");
  return update;
}

export function assertRecordId(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    fail("record id is invalid.");
  }
}
