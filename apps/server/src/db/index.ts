import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

const dbPath = process.env.DATABASE_PATH ?? fileURLToPath(new URL("../../data.db", import.meta.url));
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const agentColumns = sqlite.pragma("table_info(agents)") as { name: string }[];
if (agentColumns.length > 0 && !agentColumns.some((column) => column.name === "provider")) {
  sqlite.transaction(() => {
    sqlite.exec("ALTER TABLE agents ADD COLUMN provider TEXT NOT NULL DEFAULT 'ollama'");
    sqlite.exec("UPDATE agents SET provider = 'gemini' WHERE model LIKE 'gemini-%'");
  })();
}
export const db = drizzle(sqlite, { schema });
