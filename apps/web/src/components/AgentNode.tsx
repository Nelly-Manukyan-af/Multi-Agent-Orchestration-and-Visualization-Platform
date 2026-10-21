import React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AgentStatus } from "../runState.ts";

export type AgentNodeData = {
  label: string;
  agentId: string;
  status: AgentStatus;
  liveText: string;
  tokens: number;
};

export const AgentNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as unknown as AgentNodeData;
  const { label, status, liveText, tokens } = nodeData;

  const statusConfig: Record<AgentStatus, { border: string; bg: string; badge: string; text: string; label: string }> = {
    idle: {
      border: "#475569",
      bg: "#1e293b",
      badge: "#334155",
      text: "#94a3b8",
      label: "IDLE",
    },
    thinking: {
      border: "#38bdf8",
      bg: "#0f172a",
      badge: "#0284c7",
      text: "#38bdf8",
      label: "THINKING",
    },
    done: {
      border: "#22c55e",
      bg: "#1e293b",
      badge: "#15803d",
      text: "#86efac",
      label: "DONE",
    },
    error: {
      border: "#ef4444",
      bg: "#1e293b",
      badge: "#991b1b",
      text: "#fca5a5",
      label: "ERROR",
    },
  };

  const currentStatus = statusConfig[status] ?? statusConfig.idle;
  const isThinking = status === "thinking";

  // Last ~100 chars of live text while thinking
  const displayText = liveText.length > 100 ? "…" + liveText.slice(-100) : liveText;

  return (
    <div
      style={{
        width: "220px",
        minHeight: "100px",
        background: currentStatus.bg,
        border: `2px solid ${currentStatus.border}`,
        borderRadius: "10px",
        padding: "12px",
        color: "#f8fafc",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        boxShadow: isThinking
          ? "0 0 15px rgba(56, 189, 248, 0.4), inset 0 0 10px rgba(56, 189, 248, 0.15)"
          : "0 4px 10px rgba(0, 0, 0, 0.3)",
        transition: "all 0.25s ease-in-out",
        boxSizing: "border-box",
      }}
    >
      {/* React Flow Connection Handles */}
      <Handle type="target" position={Position.Top} style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Bottom} style={{ background: currentStatus.border }} />
      <Handle type="target" position={Position.Left} id="left" style={{ background: currentStatus.border }} />
      <Handle type="source" position={Position.Right} id="right" style={{ background: currentStatus.border }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#f8fafc" }}>{label}</span>
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            background: currentStatus.badge,
            color: "#fff",
            letterSpacing: "0.5px",
          }}
        >
          {currentStatus.label}
        </span>
      </div>

      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "6px" }}>
        Tokens: <strong style={{ color: "#cbd5e1" }}>{tokens}</strong>
      </div>

      {displayText ? (
        <div
          style={{
            background: "#0f172a",
            border: `1px solid ${isThinking ? "#38bdf8" : "#334155"}`,
            borderRadius: "6px",
            padding: "6px 8px",
            fontSize: "0.75rem",
            color: isThinking ? "#e2e8f0" : "#94a3b8",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            wordBreak: "break-word",
            maxHeight: "70px",
            overflow: "hidden",
            lineHeight: 1.35,
          }}
        >
          {displayText}
        </div>
      ) : (
        <div style={{ fontSize: "0.75rem", color: "#64748b", fontStyle: "italic" }}>
          {status === "idle" ? "Waiting..." : ""}
        </div>
      )}
    </div>
  );
};
