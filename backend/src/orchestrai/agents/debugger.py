"""Debugger agent: reads a verification failure and patches the workspace.

Same output contract as the coder (complete files, never diffs), but a
different mindset: minimal, targeted repair. It sees the failure output,
the current content of the files the failing task owns, and the task goal —
then returns corrected files plus a hypothesis (which we surface to humans
and traces: a fix without a stated cause is a guess).
"""

from pydantic import BaseModel, Field

from orchestrai.application.ports.llm import LLMProvider, Message, Usage
from orchestrai.application.ports.sandbox import Sandbox
from orchestrai.domain.models.artifact import Artifact
from orchestrai.domain.models.task import Task
from orchestrai.domain.models.verification import VerificationResult

_SYSTEM_PROMPT = """\
You are a senior debugging engineer. A task's code failed verification.

Diagnose the failure from the check output, then return:
- hypothesis: ONE sentence naming the root cause.
- files: the COMPLETE corrected content of every file you change (no diffs,
  no snippets). Only touch files that need to change to fix THIS failure.
  You may add a new file if the fix genuinely requires it.

Fix the root cause, not the symptom. Do not rewrite working code, do not
add features, do not "improve" style.
"""


class PatchDraft(BaseModel):
    """What the LLM returns: a diagnosis and corrected files."""

    class FileDraft(BaseModel):
        path: str = Field(min_length=1)
        content: str

    hypothesis: str = Field(min_length=1)
    files: tuple[FileDraft, ...] = Field(min_length=1)


class PatchResult(BaseModel):
    """Applied patch: artifacts rewritten, diagnosis, and LLM cost."""

    model_config = {"frozen": True}

    hypothesis: str
    artifacts: tuple[Artifact, ...]
    usage: Usage


def _build_context(task: Task, failure: VerificationResult, task_files: dict[str, str]) -> str:
    parts = [
        f"Task ({task.id}): {task.description}",
        "\nVerification failure:",
    ]
    for f in failure.failures:
        parts.append(f"\n[{f.check}]\n{f.summary}")
    parts.append("\nCurrent content of this task's files:")
    for path, content in task_files.items():
        parts.append(f"\n--- {path} ---\n{content}")
    return "\n".join(parts)


async def debug(
    task: Task,
    failure: VerificationResult,
    task_files: dict[str, str],
    llm: LLMProvider,
    sandbox: Sandbox,
) -> PatchResult:
    """Diagnose the failure and write corrected files into the workspace."""
    response = await llm.complete(
        [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=_build_context(task, failure, task_files)),
        ],
        output_schema=PatchDraft,
    )
    artifacts = []
    for file in response.parsed.files:
        sandbox.write_file(file.path, file.content)
        artifacts.append(Artifact(path=file.path, task_id=task.id))
    return PatchResult(
        hypothesis=response.parsed.hypothesis,
        artifacts=tuple(artifacts),
        usage=response.usage,
    )
