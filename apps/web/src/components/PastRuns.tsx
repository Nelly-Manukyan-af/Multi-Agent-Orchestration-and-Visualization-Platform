import React, { useEffect, useState } from "react";

export interface RunRecord {
  id: string;
  task: string;
  status: "running" | "completed" | "failed" | "stopped";
  startedAt: number;
  finishedAt: number | null;
}

interface PastRunsProps {
  currentViewingRunId: string | null;
  onSelectRun: (runId: string) => void;
  onBackToLive: () => void;
  isLive: boolean;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed: { bg: "#15803d", text: "#86efac" },
  running: { bg: "#0284c7", text: "#38bdf8" },
  failed: { bg: "#991b1b", text: "#fca5a5" },
  stopped: { bg: "#334155", text: "#94a3b8" },
};

export const PastRuns: React.FC<PastRunsProps> = ({
  currentViewingRunId,
  onSelectRun,
  onBackToLive,
  isLive,
}) => {
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = async () => {
    setLoading(true);
    try {
      const res = await fetch("http://localhost:3000/runs");
      if (res.ok) {
        const data = await res.json();
        setRuns(data);
      }
    } catch (err) {
      console.error("Failed to load past runs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, [isLive]); // Refresh list whenever live run starts/ends

  return (
    <div
      style={{
        background: "#1e293b",
        borderTop: "1px solid #334155",
        padding: "12px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxHeight: "180px",
        boxSizing: "border-box",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "0.92rem", color: "#f8fafc", fontWeight: 600 }}>
            Past Runs ({runs.length})
          </h3>
          {!isLive && (
            <button
              onClick={onBackToLive}
              style={{
                background: "#0284c7",
                color: "#fff",
                border: "none",
                borderRadius: "4px",
                padding: "3px 8px",
                fontSize: "0.75rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              ← Back to Live Debate
            </button>
          )}
        </div>
        <button
          onClick={fetchRuns}
          disabled={loading}
          style={{
            background: "#334155",
            color: "#94a3b8",
            border: "none",
            borderRadius: "4px",
            padding: "3px 8px",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      <div style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
        {runs.length === 0 ? (
          <div style={{ color: "#64748b", fontSize: "0.8rem", padding: "8px 0" }}>
            No saved runs yet. Start a debate to see it saved in SQLite.
          </div>
        ) : (
          runs.map((r) => {
            const isSelected = currentViewingRunId === r.id;
            const badge = STATUS_COLORS[r.status] ?? STATUS_COLORS.stopped;
            const dateStr = new Date(r.startedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            });

            return (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: isSelected ? "#0f172a" : "#0f172a",
                  border: isSelected ? "1px solid #38bdf8" : "1px solid #334155",
                  padding: "6px 12px",
                  borderRadius: "6px",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      background: badge.bg,
                      color: badge.text,
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 6px",
                      borderRadius: "4px",
                      textTransform: "uppercase",
                    }}
                  >
                    {r.status}
                  </span>
                  <span
                    style={{
                      color: "#f8fafc",
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={r.task}
                  >
                    {r.task}
                  </span>
                  <span style={{ color: "#64748b", fontSize: "0.75rem" }}>{dateStr}</span>
                </div>

                <button
                  onClick={() => onSelectRun(r.id)}
                  style={{
                    background: isSelected ? "#38bdf8" : "#334155",
                    color: isSelected ? "#0f172a" : "#f8fafc",
                    border: "none",
                    borderRadius: "4px",
                    padding: "3px 10px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    marginLeft: "8px",
                  }}
                >
                  {isSelected ? "Viewing" : "View"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
