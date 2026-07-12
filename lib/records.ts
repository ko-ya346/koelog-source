import postgres from "postgres";

export type RecordItem = {
  id: number;
  category: string;
  title: string;
  value: string;
  time: string;
  sourceText: string;
  occurredAt: string;
  createdAt: string;
  updatedAt: string;
};

export type NewRecordItem = {
  category: string;
  title: string;
  value: string;
  time: string;
  sourceText?: string;
  occurredAt?: string;
};

let client: ReturnType<typeof postgres> | null = null;
let initialized = false;

type RecordRow = {
  id: string | number;
  category: string;
  title: string;
  value: string;
  source_text: string;
  occurred_at: Date | string;
  time_label: string;
  created_at: Date | string;
  updated_at: Date | string;
};

function databaseUrl() {
  return process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
}

function db() {
  const url = databaseUrl();
  if (!url) {
    throw new Error("POSTGRES_URL or DATABASE_URL is not configured.");
  }

  client ??= postgres(url, {
    max: 1,
    prepare: false,
  });

  return client;
}

async function ensureRecordsTable() {
  if (initialized) return;

  await db()`
    create table if not exists records (
      id bigserial primary key,
      category text not null default 'メモ',
      title text not null,
      value text not null default '記録済み',
      source_text text not null default '',
      occurred_at timestamptz not null default now(),
      time_label text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  initialized = true;
}

function mapRecord(row: RecordRow): RecordItem {
  return {
    id: Number(row.id),
    category: row.category,
    title: row.title,
    value: row.value,
    sourceText: row.source_text,
    occurredAt: new Date(row.occurred_at).toISOString(),
    time: row.time_label,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listRecords() {
  await ensureRecordsTable();

  const rows = await db()`
    select id, category, title, value, source_text, occurred_at, time_label, created_at, updated_at
    from records
    order by occurred_at desc, id desc
    limit 100
  `;

  return (rows as unknown as RecordRow[]).map(mapRecord);
}

export async function createRecords(records: NewRecordItem[]) {
  await ensureRecordsTable();

  if (records.length === 0) return [];

  const values = records.map((record) => ({
    category: record.category,
    title: record.title,
    value: record.value,
    source_text: record.sourceText ?? record.title,
    occurred_at: record.occurredAt ? new Date(record.occurredAt) : new Date(),
    time_label: record.time,
  }));

  const sql = db();
  const rows = await sql`
    insert into records ${sql(values, "category", "title", "value", "source_text", "occurred_at", "time_label")}
    returning id, category, title, value, source_text, occurred_at, time_label, created_at, updated_at
  `;

  return (rows as unknown as RecordRow[]).map(mapRecord);
}

export async function deleteRecords() {
  await ensureRecordsTable();
  await db()`delete from records`;
}
