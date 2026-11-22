import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import type { ModelProvider } from "@agent-platform/shared";

// NOTE: Phase 3 moves this to PostgreSQL and adds users, ownerId on every
// user-owned table, model_connections and agent_templates/teams (SR-DATA, FR9).

export const agents = sqliteTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(), // the system prompt
  model: text("model").notNull(), // "qwen3:8b" etc.
  provider: text("provider").$type<ModelProvider>().notNull().default("ollama"),
  createdAt: integer("created_at").notNull(),
});

// A projection of the Run's events (FR7.1): written on run_started and run_finished.
export const runs = sqliteTable("runs", {
  id: text("id").primaryKey(),
  teamName: text("team_name").notNull(),
  pattern: text("pattern").notNull(), // sequential | manager_workers | group_discussion
  task: text("task").notNull(),
  status: text("status").notNull(), // running | completed | stopped | failed | loop_detected | turn_limit_reached
  startedAt: integer("started_at").notNull(),
  finishedAt: integer("finished_at"),
  totalTokens: integer("total_tokens").notNull().default(0),
  durationMs: integer("duration_ms"),
});

export const events = sqliteTable(
  "events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(), // 1, 2, 3 ... order within this run
    type: text("type").notNull(),
    payload: text("payload").notNull(), // JSON of the whole event
    timestamp: integer("timestamp").notNull(),
  },
  (t) => [uniqueIndex("events_run_seq").on(t.runId, t.seq)], // NFR4
);
