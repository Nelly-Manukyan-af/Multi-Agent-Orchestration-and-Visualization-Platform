"""
Week 3 · CrewAI: a two-agent crew (researcher + writer) on the local Ollama model.

Run:
    source ~/venvs/crewai/bin/activate
    python learning/crewai/crew.py "your topic"

Things to try:
  - Set process=Process.hierarchical (needs manager_llm=llm) to get a manager agent.
  - Set verbose=False to see how little you see without the log.
"""

import sys

from crewai import LLM, Agent, Crew, Process, Task

# Ollama runs locally, so no API key is needed.
llm = LLM(model="ollama/qwen3:8b", base_url="http://localhost:11434", temperature=0.7)

# In CrewAI an agent is a role + a goal + a backstory (the backstory works like a system prompt).
researcher = Agent(
    role="Researcher",
    goal="Find the most important facts about {topic}",
    backstory="You are a careful researcher. You list short, concrete facts and say when you are unsure.",
    llm=llm,
    verbose=True,
)

writer = Agent(
    role="Writer",
    goal="Explain {topic} to a first-year student",
    backstory="You write short, friendly texts in plain English.",
    llm=llm,
    verbose=True,
)

# A task says WHAT to do and WHO does it. {topic} is filled in from crew.kickoff(inputs=...).
research_task = Task(
    description="Research {topic}. Give 5 key facts as bullet points.",
    expected_output="5 bullet points with one fact each.",
    agent=researcher,
)

write_task = Task(
    description="Using the researcher's facts, write a paragraph of at most 120 words about {topic}.",
    expected_output="One paragraph, at most 120 words.",
    agent=writer,
    context=[research_task],  # the writer receives the researcher's output
)

# Sequential = tasks run one after another, in the order listed.
crew = Crew(
    agents=[researcher, writer],
    tasks=[research_task, write_task],
    process=Process.hierarchical,
    manager_llm=llm,
    verbose=True,
)

if __name__ == "__main__":
    topic = sys.argv[1] if len(sys.argv) > 1 else "multi-agent AI systems"
    result = crew.kickoff(inputs={"topic": topic})

    print("\n=== Final answer ===")
    print(result.raw)
    print("\n=== Token usage ===")
    print(result.token_usage)
