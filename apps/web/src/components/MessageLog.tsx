import React from "react";
import type { MessageItem } from "../runState.ts";

interface MessageLogProps {
  messages: MessageItem[];
  activeEdge: { from: string; to: string } | null;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
  onHoverEdge: (pair: { from: string; to: string } | null) => void;
}

const AGENT_COLORS: Record<string, { bg: string; text: string }> = {
  pro: { bg: "#1e3a8a", text: "#93c5fd" },
  con: { bg: "#7f1d1d", text: "#fca5a5" },
  judge: { bg: "#713f12", text: "#fef08a" },
  all: { bg: "#334155", text: "#cbd5e1" },
};

export const MessageLog: React.FC<MessageLogProps> = ({
  messages,
  activeEdge,
  selectedMessageId,
  onSelectMessage,
  onHoverEdge,
}) => {
  return (
    <aside
      style={{
        width: "380px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1e293b",
        borderLeft: "1px solid #334155",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #334155",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#f8fafc" }}>
            Message Log
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: "0.78rem", color: "#94a3b8" }}>
            Click or hover to highlight edge in graph
          </p>
        </div>
        <span
          style={{
            fontSize: "0.75rem",
            background: "#0f172a",
            padding: "2px 8px",
            borderRadius: "12px",
            color: "#38bdf8",
            fontWeight: 600,
          }}
        >
          {messages.length} msg{messages.length === 1 ? "" : "s"}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              padding: "40px 16px",
              textAlign: "center",
              color: "#64748b",
              fontSize: "0.85rem",
              lineHeight: 1.6,
            }}
          >
            Messages will appear here live as agents debate and communicate.
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSelected = selectedMessageId === msg.id;
            const isMatchingActiveEdge =
              activeEdge &&
              activeEdge.from === msg.from &&
              (activeEdge.to === msg.to || msg.to === "all");

            const fromColor = AGENT_COLORS[msg.from] ?? { bg: "#334155", text: "#fff" };
            const toColor = AGENT_COLORS[msg.to] ?? { bg: "#334155", text: "#fff" };

            const durationSec =
              msg.durationMs !== undefined ? (msg.durationMs / 1000).toFixed(1) + " s" : null;

            return (
              <div
                key={msg.id || index}
                onClick={() => onSelectMessage(isSelected ? null : msg.id)}
                onMouseEnter={() =>
                  onHoverEdge(msg.to === "all" ? null : { from: msg.from, to: msg.to })
                }
                onMouseLeave={() => onHoverEdge(null)}
                style={{
                  background: isSelected ? "#0f172a" : "#0f172a",
                  border: isSelected
                    ? "2px solid #38bdf8"
                    : isMatchingActiveEdge
                    ? "1px solid #0284c7"
                    : "1px solid #334155",
                  borderRadius: "8px",
                  padding: "12px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  boxShadow: isSelected
                    ? "0 0 12px rgba(56, 189, 248, 0.3)"
                    : "none",
                }}
              >
                {/* Header row: Speaker badge & token/duration stats */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: fromColor.bg,
                        color: fromColor.text,
                      }}
                    >
                      {msg.from.toUpperCase()}
                    </span>
                    <span style={{ color: "#64748b", fontSize: "0.8rem" }}>→</span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        background: toColor.bg,
                        color: toColor.text,
                      }}
                    >
                      {msg.to.toUpperCase()}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "#94a3b8",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {msg.tokens !== undefined && (
                      <span>{msg.tokens} tokens</span>
                    )}
                    {msg.tokens !== undefined && durationSec && <span> · </span>}
                    {durationSec && <span>{durationSec}</span>}
                  </div>
                </div>

                {/* Content quote */}
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.85rem",
                    color: "#cbd5e1",
                    lineHeight: 1.45,
                    fontStyle: "italic",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}
                >
                  "{msg.content}"
                </p>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
