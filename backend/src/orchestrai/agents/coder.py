"""Coder agent: implements one task by writing files into the sandbox.

The LLM returns a CodeDraft (a list of complete files); the agent writes
them through the sandbox — so every path passes the jail and every write is
announced on the event bus. Context assembly shows the coder the spec, the
task, and the files that its dependency tasks produced.
"""

from pydantic import BaseModel, Field

from orchestrai.application.ports.llm import LLMProvider, Message, Usage
from orchestrai.application.ports.sandbox import Sandbox
from orchestrai.domain.models.artifact import Artifact
from orchestrai.domain.models.requirement_spec import RequirementSpec
from orchestrai.domain.models.task import Task

_SYSTEM_PROMPT = """\
You are a senior Python engineer implementing ONE task of a larger project.

Return the COMPLETE content of every file this task requires — new files,
plus updated versions of existing files when the task changes them. Partial
snippets and diffs are not allowed; each file you return fully replaces any
previous version at that path.

Rules:
- paths are relative to the project root (e.g. "app/main.py").
- write production-quality, typed, working Python; include imports.
- stay within THIS task's scope; other tasks handle the rest.
- if the task needs dependencies, include/extend requirements.txt.
"""


class CodeDraft(BaseModel):
    """What the LLM returns: complete files for one task."""

    class FileDraft(BaseModel):
        path: str = Field(min_length=1)
        content: str

    files: tuple[FileDraft, ...] = Field(min_length=1)


class CodeResult(BaseModel):
    """Artifacts written for a task, plus what the LLM call cost."""

    model_config = {"frozen": True}

    artifacts: tuple[Artifact, ...]
    usage: Usage


def _build_context(spec: RequirementSpec, task: Task, dependency_artifacts: dict[str, str]) -> str:
    parts = [
        f"Project: {spec.summary}",
        f"Tech stack: {', '.join(spec.tech_stack) or 'unspecified'}",
        f"\nYour task ({task.id}): {task.description}",
    ]
    if dependency_artifacts:
        parts.append("\nFiles already produced by tasks you depend on:")
        for path, content in dependency_artifacts.items():
            parts.append(f"\n--- {path} ---\n{content}")
    return "\n".join(parts)


async def code(
    spec: RequirementSpec,
    task: Task,
    dependency_artifacts: dict[str, str],
    llm: LLMProvider,
    sandbox: Sandbox,
) -> CodeResult:
    """Implement one task: ask the LLM for files, write them via the sandbox."""
    response = await llm.complete(
        [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content=_build_context(spec, task, dependency_artifacts)),
        ],
        output_schema=CodeDraft,
    )
    artifacts = []
    for file in response.parsed.files:
        sandbox.write_file(file.path, file.content)
        artifacts.append(Artifact(path=file.path, task_id=task.id))
    return CodeResult(artifacts=tuple(artifacts), usage=response.usage)
