"""Analyst agent: turns a raw user prompt into a RequirementSpec."""

from orchestrai.application.ports.llm import LLMProvider, LLMResponse, Message
from orchestrai.domain.models.requirement_spec import RequirementSpec

_SYSTEM_PROMPT = """\
You are a senior requirements analyst for a software engineering platform.

Read the user's project prompt and produce a RequirementSpec:
- summary: one sentence describing the project.
- functional_requirements: concrete, testable capabilities.
- constraints: non-functional demands (frameworks, tooling, deployment).
- tech_stack: technologies that are either explicitly requested or clearly implied.
- ambiguities: decisions the prompt leaves open. For each one:
  * kind="resolved" — pick a sensible default and give a one-line rationale.
  * kind="open" — only when a wrong guess would waste significant work;
    include 2-4 options. Prefer resolving with defaults; escalate sparingly.

Be faithful to the prompt: do not invent requirements the user never asked for.
"""


async def analyze(prompt: str, llm: LLMProvider) -> LLMResponse[RequirementSpec]:
    """Run requirement analysis over the user's prompt."""
    return await llm.complete(
        [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=prompt),
        ],
        output_schema=RequirementSpec,
    )
