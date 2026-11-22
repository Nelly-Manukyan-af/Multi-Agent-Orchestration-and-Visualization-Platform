import { pgTable, text, integer, bigint, serial, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import type { AgentEvent, ModelProvider } from "@agent-platform/shared";

export const agents = pgTable("agents", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  model: text("model").notNull(),
  provider: text("provider").$type<ModelProvider>().notNull().default("ollama"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
});

export const runs = pgTable("runs", {
  id: text("id").primaryKey(),
  teamName: text("team_name").notNull(),
  pattern: text("pattern").notNull(),
  task: text("task").notNull(),
  status: text("status").notNull(),
  startedAt: bigint("started_at", { mode: "number" }).notNull(),
  finishedAt: bigint("finished_at", { mode: "number" }),
  totalTokens: integer("total_tokens").notNull().default(0),
  durationMs: bigint("duration_ms", { mode: "number" }),
});

export const events = pgTable(
  "events",
  {
    id: serial("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => runs.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<AgentEvent>().notNull(),
    timestamp: bigint("timestamp", { mode: "number" }).notNull(),
  },
  (t) => [uniqueIndex("events_run_seq").on(t.runId, t.seq)],
);
