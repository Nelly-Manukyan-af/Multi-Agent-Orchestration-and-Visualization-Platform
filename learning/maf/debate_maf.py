"""
Microsoft Agent Framework (MAF): the Pro / Con / Judge debate on qwen3:8b, shown in DevUI.

Run (venv ~/venvs/maf):
    source ~/venvs/maf/bin/activate
    cd ~/Desktop/uni-project/learning/maf
    python debate_maf.py              # DevUI on http://127.0.0.1:8090
    python debate_maf.py --console    # same debate, printed in the terminal

Same team as learning/autogen/debate_autogen.py, but the order is fixed like the platform's
Group Discussion pattern: Pro and Con alternate for ROUNDS rounds, then the Judge speaks once.
"""

import asyncio
import os
import sys

from agent_framework import Agent
from agent_framework.ollama import OllamaChatClient
from agent_framework.orchestrations import GroupChatBuilder, GroupChatState

ROUNDS = int(os.environ.get("DEBATE_ROUNDS", "3"))
TOPIC = "Remote work is better than office work"

client = OllamaChatClient(host="http://localhost:11434", model="qwen3:8b")
options = {"temperature": 0.7, "think": False}  # think=False turns off qwen3's reasoning output

pro = Agent(
    client,
    "You are in a formal debate. Argue strictly FOR the topic. Never agree with Con. "
    "Reply to your opponent's last point if there is one. Max 80 words.",
    name="Pro",
    description="Argues for the topic",
    default_options=options,
)
con = Agent(
    client,
    "You are in a formal debate. Argue strictly AGAINST the topic. Never agree with Pro. "
    "Reply to your opponent's last point. Max 80 words.",
    name="Con",
    description="Argues against the topic",
    default_options=options,
)
judge = Agent(
    client,
    "You read a debate between Pro and Con and pick the winner. Give the winner and 2-3 reasons.",
    name="Judge",
    description="Decides the winner at the end",
    default_options=options,
)


def next_speaker(state: GroupChatState) -> str:
    """Pro, Con, Pro, Con, ... for ROUNDS rounds, then the Judge."""
    if state.current_round < ROUNDS * 2:
        return "Pro" if state.current_round % 2 == 0 else "Con"
    return "Judge"


workflow = (
    GroupChatBuilder(
        name="Debate",
        participants=[pro, con, judge],
        selection_func=next_speaker,
        max_rounds=ROUNDS * 2 + 1,
        output_from="all",  # emit every participant's reply, not only the final notice
    )
).build()


async def console() -> None:
    result = await workflow.run(f"Debate topic: {TOPIC}")
    for response in result.get_outputs():  # one AgentResponse per Turn (plus the final notice)
        speaker = next((m.author_name for m in response.messages if m.author_name), "orchestrator")
        print(f"\n---------- {speaker} ----------")
        print(response.text)


if __name__ == "__main__":
    if "--console" in sys.argv:
        asyncio.run(console())
    else:
        from agent_framework.devui import serve

        # Local-only (127.0.0.1), so the access token is switched off for convenience.
        serve(entities=[workflow], port=8090, auth_enabled=False)
