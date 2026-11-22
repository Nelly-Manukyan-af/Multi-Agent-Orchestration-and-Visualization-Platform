import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema.ts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString?.trim()) {
  throw new Error("DATABASE_URL is required");
}

export const pool = new Pool({ connectionString, connectionTimeoutMillis: 5000 });
pool.on("error", (error) => console.error("Database connection failed:", error.message));
export const db = drizzle(pool, { schema });

export async function migrateDatabase(): Promise<void> {
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL("../../drizzle/", import.meta.url)),
  });
}

export async function closeDatabase(): Promise<void> {
  await pool.end();
}
