# debate_autogen.py
import asyncio
from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.teams import RoundRobinGroupChat
from autogen_agentchat.conditions import MaxMessageTermination
from autogen_agentchat.ui import Console
from autogen_ext.models.ollama import OllamaChatCompletionClient

async def get_agent_team():
    model = OllamaChatCompletionClient(
        model="qwen3:8b",
        model_info={
            "vision": False,
            "function_calling": True,
            "json_output": True,
            "structured_output": True,
            "family": "unknown",
        },
    )
    pro = AssistantAgent("Pro", model_client=model,
        system_message="Argue strictly FOR the topic. Never agree with Con. Max 80 words.")
    con = AssistantAgent("Con", model_client=model,
        system_message="Argue strictly AGAINST the topic. Never agree with Pro. Max 80 words.")
    judge = AssistantAgent("Judge", model_client=model,
        system_message="Read the debate and pick the winner with 2-3 reasons.")
    # task message + 3 rounds x 3 speakers = 10 messages
    return RoundRobinGroupChat([pro, con, judge], termination_condition=MaxMessageTermination(10))

async def main():
    team = await get_agent_team()
    await Console(team.run_stream(task="Debate: Remote work is better than office work"))

if __name__ == "__main__":
    asyncio.run(main())