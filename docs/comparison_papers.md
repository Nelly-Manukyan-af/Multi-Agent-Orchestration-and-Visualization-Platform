# Multi-Agent LLM Papers: A Comparison

Oct 15, 2026 · @Nelly

## 1. Quick identity card

Five 2023 papers, one question: how should LLM agents work together, and what should go on inside each one?

|  | CAMEL | Generative Agents | ChatDev | MetaGPT | AutoGen |
| --- | --- | --- | --- | --- | --- |
| Released | Mar 2023 | Apr 2023 | Jul 2023 | Aug 2023 | Aug 2023 |
| From | KAUST | Stanford + Google | Tsinghua | DeepWisdom + KAUST | Microsoft + Penn State |
| Goal | Make two agents cooperate autonomously; generate data | Simulate believable human behavior | Build software from a one-line request | Build software reliably, like a real company | General framework for any multi-agent app |
| Core idea | Role-playing + inception prompting | Memory stream + reflection + planning | Chat chain + communicative dehallucination | SOPs + structured documents + message pool | Conversable agents + conversation programming |
| Main model | gpt-3.5-turbo | gpt-3.5-turbo | ChatGPT-3.5 | Mostly GPT-4 | GPT-4 / GPT-3.5 |
| Contribution type | Method + datasets | Agent architecture | Application | Application / framework | General framework |

## 2. What they all have in common

All five rely on prompting off-the-shelf OpenAI models, not training new ones, and all fight the same LLM weaknesses.

1. **Roles assigned through system prompts.** Every paper gives the LLM an identity and relies on it staying in character. Ablations show roles matter: ChatDev's biggest drop came from removing roles; MetaGPT's executability rose from 1.0 to 4.0 as roles were added.
2. **Natural language as the universal interface.** Agents communicate in text. MetaGPT adds structure on top, but it is still text.
3. **Breaking big problems into smaller steps.** CAMEL's instruction loop, ChatDev's phases, MetaGPT's assembly line, AutoGen's hand-offs and Generative Agents' recursive day plans.
4. **Minimal human input at the start.** A one-line idea, a one-paragraph persona or an initial message is enough.
5. **The same weaknesses:** hallucination, losing track of roles, loops and limited context windows. Each main mechanism is a different answer to these.
6. **More agents or a richer architecture beats one plain LLM call**, at the cost of more tokens and time.
7. **All are open source** and built on 2023 OpenAI models.

## 3. Key differences

The biggest divide is purpose: four papers solve tasks, while Generative Agents simulates life with no correct answer, only believability. The table compares all five on each design dimension.

| Dimension | CAMEL | Generative Agents | ChatDev | MetaGPT | AutoGen |
| --- | --- | --- | --- | --- | --- |
| Purpose | Solve a task | Simulate believable humans | Build software | Build software | Any application |
| Scope | General topics, one fixed pattern | Social simulation only | Software only | Software only | Most general |
| Topology | Exactly 2 (user and assistant) plus a task specifier | 25 agents; chats start spontaneously when agents meet | Many roles, only 2 talk at a time, chained in sequence | 5 roles on an assembly line with a global message pool | Anything: 2 agents, nested chats, dynamic group chat with a manager |
| Communication | Chat with a forced format (Instruction / Solution / Next request) | Completely natural conversation | Chat plus clarifying questions from the assistant | Formal documents: PRD, design, task list, code | Developer's choice |
| Control flow | AI user decides; done-token or hard limits | Each agent's own plans and reactions; no central controller | Fixed waterfall; each pair chats until agreement or 10 rounds | Fixed SOP; agents start once required inputs arrive | Auto-reply; static or dynamic; prompts or Python code |
| Memory | Conversation history only | Full memory stream, scored retrieval, reflection trees | Short-term within a phase; only final solutions passed forward | Shared message pool with subscriptions | Each agent's own conversation context |
| Runs code or tools | No; agents only write code | Acts on a game world (objects change state) | Yes, testing phase with compiler feedback | Yes, unit tests with up to 3 retries | Yes, central to the design |
| Human involvement | Autonomous after the initial prompt | User can interview agents, speak as their inner voice, or edit the world | Autonomous after the initial prompt | Autonomous after the initial prompt | Humans can join anytime (ALWAYS / NEVER / skip) |
| Evaluation | Human and GPT-4 judges vs single-shot GPT-3.5; HumanEval for a fine-tuned 7B model | 100 human raters ranking believability; info spread and network density | Own dataset (SRDD, 1,200 tasks); completeness, executability, consistency, quality | HumanEval, MBPP and own SoftwareDev (7 tasks in the main comparison) | Many small case studies across 6+ domains |

**Communication runs on a spectrum from free to rigid:** Generative Agents (free chat) → CAMEL → ChatDev → AutoGen (developer chooses) → MetaGPT (rigid documents). MetaGPT explicitly rejects chat, arguing free dialogue distorts information like a game of telephone.

&#91;embedded content: communication spectrum · 5 papers, free to rigid\]

## 4. Benefits and drawbacks of each

### CAMEL

**Benefits**

- Simple, elegant recipe that started this line of work; ChatDev reuses its inception prompting.
- Clear documentation of failure modes: role flipping, repeated instructions, flake replies, infinite loops.
- Doubles as a scalable data generator: 25,000 conversations plus Code, Math and Science sets, used to fine-tune a better 7B model.
- Honest about safety, with its "bad mind" world-takeover example.

**Drawbacks**

- No code execution or tools, so solutions are never verified.
- Only one static pattern: two agents, fixed roles.
- Relies entirely on prompts to stop bad behavior.
- Compares a long multi-turn conversation (summarized by GPT-4) with one short GPT-3.5 answer; judges tend to prefer longer answers, as the authors note.
- Cost grows quadratically with conversation length, forcing a 40-message cap.

### Generative Agents

**Benefits**

- The richest single-agent architecture of the five; its retrieval (recency + importance + relevance) and reflection became widely borrowed.
- Genuine emergent social behavior from tiny seeds.
- Careful evaluation with ablations, statistical tests and honest error analysis.
- Opens non-task uses: games, social science, design prototyping, rehearsal tools.

**Drawbacks**

- Very expensive: thousands of dollars and several days for 25 agents over 2 game days.
- Not built to solve tasks; believability is a soft, subjective target.
- Retrieval sometimes fails, agents embellish memories and miss unwritten norms.
- Instruction tuning makes agents too polite and agreeable; personalities drift.
- Only a 2-day simulation; long-term stability unknown.

### ChatDev

**Benefits**

- Transparent structure: every subtask is two agents talking, easy to inspect and debug.
- Communicative dehallucination lets the assistant ask for specifics first, reducing broken code.
- Passing only final results between phases keeps context small.
- Strong executability (88%) and clear ablations per phase.

**Drawbacks**

- Rigid waterfall that cannot adapt to the task.
- Free chat within phases, which MetaGPT argues lets errors creep in.
- Simple logic; vague requests yield basic software. The authors say it suits prototypes.
- Its consistency metric (embedding similarity of requirements and code) is a weak proxy.
- Slower and more expensive than a single agent.

### MetaGPT

**Benefits**

- Structured documents greatly reduce miscommunication and cascading hallucinations.
- Publish-subscribe message pool beats one-to-one messaging and avoids overload.
- Executable feedback with unit tests measurably improves code.
- Strongest benchmark results of the group: 85.9% HumanEval, 87.7% MBPP, fewest human corrections.
- Mirrors real engineering practice, so its PRDs and designs are useful to humans too.

**Drawbacks**

- SOPs are hand-designed for software; other domains need new procedures.
- Rigid assembly line, less flexibility and creativity.
- Uses more total tokens than ChatDev.
- The ChatDev comparison used 7 tasks and human scoring, and MetaGPT ran on GPT-4 while ChatDev's paper used GPT-3.5.
- Weak at UI and front-end; hard to interrupt or checkpoint.

### AutoGen

**Benefits**

- Most flexible and general: any topology, any domain, static or dynamic.
- Mixes control in natural language and Python code.
- First-class human-in-the-loop support and real code and tool execution.
- Strong results with little code: the OptiGuide workflow shrank from 430 to 100 lines.
- Reuses other tools, such as LangChain tools or other agents wrapped as conversable agents.

**Drawbacks**

- The developer must design agents, roles and conversation patterns: building blocks, not a recipe.
- Many tunable choices with no clear best answer, as the authors admit.
- Autonomous code execution is risky without safeguards.
- Evaluations are many small studies; group chat was tested on only 12 tasks.
- Natural-language control depends on the LLM following instructions.

## 5. Head-to-head comparisons

**CAMEL vs ChatDev: parent and child.** ChatDev chains many CAMEL-style two-agent chats into a pipeline, adding code execution and memory between phases. CAMEL forbids role flipping as a bug; ChatDev uses a controlled reversal, the assistant asking clarifying questions, as a feature.

**ChatDev vs MetaGPT: same goal, opposite philosophy.** Both simulate a software company with similar roles. ChatDev treats dialogue as the strength; MetaGPT treats it as the weakness and forces formal documents. Each claims to beat the other on different datasets, metrics and model versions, so each shows its own idea helps, not a final ranking.

**MetaGPT vs AutoGen: opinionated vs flexible.** MetaGPT is a fixed, proven procedure for one domain, like buying a finished factory. AutoGen gives general tools to build any procedure, like buying machines and designing the factory yourself.

**Generative Agents vs the rest: inside vs between.** The other four focus on coordination between fairly simple agents. Generative Agents focuses on memory, reflection and planning inside one agent. The two directions are complementary: its memory would help ChatDev, which discards chat history between phases.

**Generative Agents vs AutoGen group chat: who speaks next.** AutoGen uses a central manager to pick the next speaker. In Generative Agents nobody decides; agents start conversations when they meet. Central control is easier to steer; decentralized is more natural but less predictable.

## 6. Main tradeoffs across all five

The central tension of the field is freedom vs reliability; the other four tradeoffs follow from design choices around it.

| Tradeoff | One side | Other side |
| --- | --- | --- |
| Freedom vs reliability | Free conversation (Generative Agents, CAMEL): creative, natural, but more drift, loops and hallucination | Structure (MetaGPT): reliable, but less flexible |
| Generality vs ready-to-use | AutoGen works for anything but needs design work | ChatDev and MetaGPT work out of the box, for software only |
| Autonomy vs safety | Full autonomy (CAMEL, ChatDev, MetaGPT) is convenient but risky with code execution | AutoGen's human-in-the-loop and Generative Agents' audit logs are partial answers |
| Quality vs cost | Every paper buys better results with more LLM calls | Generative Agents is the extreme; ChatDev and MetaGPT are much slower than single agents |
| Verification | Pure chat (CAMEL) cannot catch errors | Grounding in reality (a compiler, a chess board agent, a game world) beats prompting agents to be careful |

## 7. Shared limitations none of them solve

- **Hallucination** persists in all five, just less.
- **Evaluation is inconsistent.** Each paper invents its own metrics or datasets, often uses LLM judges that favor long answers, and compares systems run on different models. Do not compare numbers across papers directly.
- **Cost and speed** limit real-world use.
- **Dependence on the base model.** Results drop sharply on weaker models (MetaGPT's GPT-3.5 and DeepSeek runs), and quirks like excessive politeness leak into behavior.
- **Safety and misuse** are acknowledged by all, solved by none.

## 8. When to choose each

| If you want to… | Use |
| --- | --- |
| Study agent behavior or generate training data | CAMEL's role-playing |
| Simulate people, NPCs or social dynamics | Generative Agents' architecture |
| Get quick software prototypes with a transparent process | ChatDev |
| Generate software more reliably, with documentation | MetaGPT |
| Build your own multi-agent app with tools and humans in the loop | AutoGen |

**In one sentence:** CAMEL showed two agents can cooperate if prompted carefully; ChatDev chained that into a software pipeline; MetaGPT argued structured documents beat chatting; AutoGen generalized everything into a flexible framework; and Generative Agents showed that real memory, reflection and planning make behavior coherent over time.

## Sources

- [CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society (arXiv 2303.17760)](https://arxiv.org/pdf/2303.17760)
- [Generative Agents: Interactive Simulacra of Human Behavior (arXiv 2304.03442)](https://arxiv.org/abs/2304.03442)
- [ChatDev: Communicative Agents for Software Development (arXiv 2307.07924)](https://arxiv.org/abs/2307.07924)
- [MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework (arXiv 2308.00352)](https://arxiv.org/abs/2308.00352)
- [AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation (arXiv 2308.08155)](https://arxiv.org/pdf/2308.08155)
