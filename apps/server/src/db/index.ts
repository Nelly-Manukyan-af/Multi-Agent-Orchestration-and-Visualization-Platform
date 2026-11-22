import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.ts";

const dbPath = process.env.DATABASE_PATH ?? fileURLToPath(new URL("../../data.db", import.meta.url));
const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
export const db = drizzle(sqlite, { schema });
