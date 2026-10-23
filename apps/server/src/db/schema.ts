import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // the system prompt
  model: text("model").notNull(), // "qwen3:8b" etc.
  createdAt: integer("created_at").notNull(),
});

export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  task: text("task").notNull(), // the debate topic or task
  status: text("status").notNull(), // running | completed | failed | stopped
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
});

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.id),
  seq: integer("seq").notNull(), // 1, 2, 3... order within this run
  type: text("type").notNull(), // agent_started, message_sent, etc.
  payload: text("payload").notNull(), // JSON string of the whole event
  timestamp: integer("timestamp").notNull(),
});
