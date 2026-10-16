from typing import TypedDict

from langchain_ollama import ChatOllama
from langgraph.graph import END, START, StateGraph

# reasoning=False turns off qwen3's thinking (what /no_think failed to do in AutoGen)
llm = ChatOllama(model="qwen3:8b", reasoning=False)


# The state is the shared data that moves through the graph.
class State(TypedDict):
    topic: str
    facts: str
    paragraph: str


def researcher(state: State) -> dict:
    reply = llm.invoke(f"Give 5 key facts about {state['topic']} as bullet points.")
    return {"facts": reply.content}


def writer(state: State) -> dict:
    reply = llm.invoke(
        f"Using these facts, write one paragraph of at most 120 words:\n{state['facts']}"
    )
    return {"paragraph": reply.content}


builder = StateGraph(State)
builder.add_node("researcher", researcher)
builder.add_node("writer", writer)
builder.add_edge(START, "researcher")
builder.add_edge("researcher", "writer")
builder.add_edge("writer", END)
graph = builder.compile()

