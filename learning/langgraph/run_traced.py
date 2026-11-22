from dotenv import load_dotenv
load_dotenv()

from langfuse import get_client
from langfuse.langchain import CallbackHandler
from agent import graph

result = graph.invoke({"topic": "the Moon"}, config={"callbacks": [CallbackHandler()]})
print(result["score"])
get_client().flush()