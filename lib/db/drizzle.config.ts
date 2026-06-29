import { defineConfig } from "drizzle-kit";
import path from "path";

// Prefer a direct (unpooled) connection for DDL/migrations — Neon's pooled
// (pgbouncer) URL can choke on some migration statements. Falls back to the
// regular URL when no unpooled one is provided.
const migrationUrl =
  process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;

if (!migrationUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: migrationUrl,
  },
});
