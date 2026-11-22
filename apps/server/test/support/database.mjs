import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Never migrate, truncate, or drop the database supplied by the developer.
export async function createTestDatabase() {
  const adminUrl = process.env.TEST_DATABASE_URL
    ?? "postgresql://agent_platform:devpassword@127.0.0.1:5432/agent_platform";
  const admin = new Pool({ connectionString: adminUrl, connectionTimeoutMillis: 3000 });
  const name = `agent_test_${randomUUID().replaceAll("-", "")}`;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } catch (cause) {
    await admin.end();
    throw new Error("Cannot create test database. Start PostgreSQL with `docker compose up -d postgres`, or set TEST_DATABASE_URL to a PostgreSQL account with CREATEDB permission.", { cause });
  }
  const url = new URL(adminUrl);
  url.pathname = `/${name}`;
  return {
    url: url.toString(),
    async close() {
      try {
        await admin.query(`DROP DATABASE "${name}"`);
      } finally {
        await admin.end();
      }
    },
  };
}
