"""Planner agent: turns an approved RequirementSpec into a task Plan.

The LLM emits a PlanDraft (plain task descriptions + dependencies); the
domain's Plan validator then enforces DAG rules. If the model produced a
cycle or a dangling dependency, InvalidPlanError surfaces to the caller —
the graph decides whether to retry.
"""

from pydantic import BaseModel, Field

from orchestrai.application.ports.llm import LLMProvider, Message, Usage
from orchestrai.domain.models.plan import Plan
from orchestrai.domain.models.requirement_spec import RequirementSpec
from orchestrai.domain.models.task import Task

_SYSTEM_PROMPT = """\
You are a senior software architect. Break the given RequirementSpec into an
ordered list of implementation tasks.

Rules:
- Each task is one focused unit of work (one feature/layer slice), described
  concretely enough that a coding agent can implement it without guessing.
- ids are short slugs like "t1", "t2".
- depends_on lists ids of tasks that MUST be completed first. Dependencies
  must form a DAG: no cycles, no references to unknown ids.
- Order foundations first (project scaffold, models) then features, then
  cross-cutting concerns (auth wiring, docs).
- 3 to 10 tasks. Prefer fewer, larger, coherent tasks over many fragments.
"""


class PlanDraft(BaseModel):
    """What the LLM returns: task descriptions before domain validation."""

    class TaskDraft(BaseModel):
        id: str = Field(min_length=1)
        description: str = Field(min_length=1)
        depends_on: tuple[str, ...] = ()

    tasks: tuple[TaskDraft, ...] = Field(min_length=1)


class PlanResult(BaseModel):
    """A validated plan plus what it cost to produce."""

    model_config = {"arbitrary_types_allowed": True, "frozen": True}

    plan: Plan
    usage: Usage


async def plan(spec: RequirementSpec, llm: LLMProvider) -> PlanResult:
    """Produce a validated task DAG for an approved spec.

    Raises:
        InvalidPlanError: if the model's draft violates DAG rules.
    """
    spec_text = spec.model_dump_json(indent=2)
    response = await llm.complete(
        [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=f"RequirementSpec:\n{spec_text}"),
        ],
        output_schema=PlanDraft,
    )
    validated = Plan(
        tasks=tuple(
            Task(id=d.id, description=d.description, depends_on=d.depends_on)
            for d in response.parsed.tasks
        )
    )
    return PlanResult(plan=validated, usage=response.usage)
