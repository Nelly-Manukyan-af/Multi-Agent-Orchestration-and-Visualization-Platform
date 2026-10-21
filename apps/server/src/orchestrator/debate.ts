import type { AgentEvent } from "@agent-platform/shared";
import { chat, type Message } from "../llm/ollama.ts";
import { makeEvent } from "../events.ts";

export async function runDebate(
    runId: string,
    topic: string,
    emit: (event: AgentEvent) => void, // the orchestrator does not know WHERE events go
): Promise<void> {
    // ---------------- Defining agents ----------------

    type Agent = { name: "Pro" | "Con" | "Judge"; systemPrompt: string };

    const Pro: Agent = {
        name: "Pro",
        systemPrompt:
            "You are in a formal debate. You MUST argue strictly IN FAVOR OF (FOR) the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point if there is one. Do not start your reply with 'Pro:'. Max 80 words.",
    };

    const Con: Agent = {
        name: "Con",
        systemPrompt:
            "You are in a formal debate. You MUST argue strictly AGAINST the topic, even as a role-play exercise. Never agree with your opponent. Reply directly to your opponent's last point. Do not start your reply with 'Con:'. Max 80 words.",
    };

    const Judge: Agent = {
        name: "Judge",
        systemPrompt: "You read a debate and pick the winner. Give the winner and 2–3 reasons.",
    };

    type Turn = { speaker: string; text: string };
    const turns: Turn[] = [];

    function messagesFor(agent: Agent, turns: Turn[], topic: string): Message[] {
        const stance = agent.name === "Pro" ? "FOR (in favor of)" : "AGAINST (opposing)";
        const messages: Message[] = [
            { role: "system", content: agent.systemPrompt },
            {
                role: "user",
                content: `Debate topic: "${topic}". You are ${agent.name}, arguing strictly ${stance} this topic.`,
            },
        ];

        for (const turn of turns) {
            if (turn.speaker === agent.name) {
                messages.push({ role: "assistant", content: turn.text });
            } else {
                messages.push({ role: "user", content: `${turn.speaker}: ${turn.text}` });
            }
        }

        return messages;
    }

    const ROUNDS = 3;

    emit(makeEvent(runId, {
        type: "run_started",
        task: topic,
        agentIds: ["pro", "con", "judge"],
    }));

// ---------------- The debate rounds ----------------
    try {
        for (let round = 1; round <= ROUNDS; round++) {
            // --- Pro's turn ---
            emit(
                makeEvent(runId, {
                    type: "agent_started",
                    agentId: "pro",
                })
            );
            const proResult = await chat(messagesFor(Pro, turns, topic), undefined, (piece) => {
                emit(
                    makeEvent(runId, {
                        type: "llm_token",
                        agentId: "pro",
                        text: piece,
                    })
                );
            });
            const proText = proResult.message.content.replace(/^Pro:\s*/i, "").trim();
            turns.push({ speaker: Pro.name, text: proText });

            emit(
                makeEvent(runId, {
                    type: "llm_response",
                    agentId: "pro",
                    promptTokens: proResult.promptTokens,
                    outputTokens: proResult.outputTokens,
                    durationMs: proResult.durationMs,
                })
            );
            emit(
                makeEvent(runId, {
                    type: "message_sent",
                    fromAgentId: "pro",
                    toAgentId: "con",
                    content: proText,
                })
            );
            emit(
                makeEvent(runId, {
                    type: "agent_finished",
                    agentId: "pro",
                    result: proText,
                })
            );

            // --- Con's turn ---
            emit(
                makeEvent(runId, {
                    type: "agent_started",
                    agentId: "con",
                })
            );
            const conResult = await chat(messagesFor(Con, turns, topic), undefined, (piece) => {
                emit(
                    makeEvent(runId, {
                        type: "llm_token",
                        agentId: "con",
                        text: piece,
                    })
                );
            });
            const conText = conResult.message.content.replace(/^Con:\s*/i, "").trim();
            turns.push({ speaker: Con.name, text: conText });

            emit(
                makeEvent(runId, {
                    type: "llm_response",
                    agentId: "con",
                    promptTokens: conResult.promptTokens,
                    outputTokens: conResult.outputTokens,
                    durationMs: conResult.durationMs,
                })
            );
            emit(
                makeEvent(runId, {
                    type: "message_sent",
                    fromAgentId: "con",
                    toAgentId: "pro",
                    content: conText,
                })
            );
            emit(
                makeEvent(runId, {
                    type: "agent_finished",
                    agentId: "con",
                    result: conText,
                })
            );
        }

        // ---------------- Judge's turn ----------------
        emit(
            makeEvent(runId, {
                type: "agent_started",
                agentId: "judge",
            })
        );
        const transcript = turns.map((t) => `${t.speaker}: ${t.text}`).join("\n\n");
        const judgeMessages: Message[] = [
            { role: "system", content: Judge.systemPrompt },
            {
                role: "user",
                content: `Debate topic: "${topic}"\n\nDebate transcript:\n${transcript}\n\nPlease evaluate the debate and decide the winner. Explicitly state the winner (Pro or Con) and give 2–3 reasons.`,
            },
        ];

        const judgeResult = await chat(judgeMessages, undefined, (piece) => {
            emit(
                makeEvent(runId, {
                    type: "llm_token",
                    agentId: "judge",
                    text: piece,
                })
            );
        });

        const verdict = judgeResult.message.content;

        emit(
            makeEvent(runId, {
                type: "llm_response",
                agentId: "judge",
                promptTokens: judgeResult.promptTokens,
                outputTokens: judgeResult.outputTokens,
                durationMs: judgeResult.durationMs,
            })
        );
        emit(
            makeEvent(runId, {
                type: "message_sent",
                fromAgentId: "judge",
                toAgentId: "all",
                content: verdict,
            })
        );
        emit(
            makeEvent(runId, {
                type: "agent_finished",
                agentId: "judge",
                result: verdict,
            })
        );

        emit(
            makeEvent(runId, {
                type: "run_finished",
                status: "completed",
            })
        );
    } catch (e) {
        emit(
            makeEvent(runId, {
                type: "run_finished",
                status: "failed",
            })
        );
    }
}

// runDebate("test-run-1", "Cats vs Dogs", (e) => {
//     console.log(e.type, e);
// });
