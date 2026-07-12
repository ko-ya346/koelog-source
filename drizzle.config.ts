import { existsSync, readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

function loadDotEnvLocal() {
  if (!existsSync(".env.local")) return;

  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index < 0) continue;

    const key = line.slice(0, index);
    let value = line.slice(index + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] ??= value.replace(/\\n/g, "\n");
  }
}

function isMigrateCommand() {
  return process.argv.some((arg) => arg === "migrate" || arg.endsWith(":migrate"));
}

function databaseUrl() {
  loadDotEnvLocal();

  if (isMigrateCommand() && process.env.KOELOG_DB_TARGET !== "development") {
    throw new Error(
      "Refusing to run migrations without KOELOG_DB_TARGET=development. Production migrations require a separate, explicit procedure.",
    );
  }

  const url =
    process.env.DATABASE_MIGRATION_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    process.env.POSTGRES_URL_NON_POOLING ??
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL;

  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Pull the Vercel Development environment variables into .env.local.",
    );
  }

  return url;
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl(),
  },
  strict: true,
  verbose: true,
});
