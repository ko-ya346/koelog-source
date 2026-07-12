import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

let client: postgres.Sql | null = null;

function databaseUrl() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Pull the Vercel Development environment variables into .env.local.",
    );
  }

  return url;
}

function getClient() {
  client ??= postgres(databaseUrl(), {
    max: 1,
    prepare: false,
  });

  return client;
}

export const db = drizzle(getClient(), { schema });
