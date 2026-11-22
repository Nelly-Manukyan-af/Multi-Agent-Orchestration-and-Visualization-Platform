CREATE TABLE "agents" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "role" text NOT NULL,
  "model" text NOT NULL,
  "provider" text DEFAULT 'ollama' NOT NULL,
  "created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "runs" (
  "id" text PRIMARY KEY NOT NULL,
  "team_name" text NOT NULL,
  "pattern" text NOT NULL,
  "task" text NOT NULL,
  "status" text NOT NULL,
  "started_at" bigint NOT NULL,
  "finished_at" bigint,
  "total_tokens" integer DEFAULT 0 NOT NULL,
  "duration_ms" bigint
);
--> statement-breakpoint
CREATE TABLE "events" (
  "id" serial PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL,
  "seq" integer NOT NULL,
  "type" text NOT NULL,
  "payload" jsonb NOT NULL,
  "timestamp" bigint NOT NULL,
  CONSTRAINT "events_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE
);
--> statement-breakpoint
CREATE UNIQUE INDEX "events_run_seq" ON "events" USING btree ("run_id", "seq");
