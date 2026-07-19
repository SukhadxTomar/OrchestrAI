"""Reviewer agent: final quality review and documentation of the built project.

Two responsibilities, one agent (documentation is a review mode, not a
sixth agent): reading the whole generated project and (a) producing a
bounded verdict with findings, (b) writing its README.

The reviewer never edits code — findings are advisory, surfaced to the
human in the final report. Bounded by design: one pass, no review loops.
"""

from typing import Literal

from pydantic import BaseModel, Field

from orchestrai.application.ports.llm import LLMProvider, Message, Usage
from orchestrai.application.ports.sandbox import Sandbox
from orchestrai.domain.models.requirement_spec import RequirementSpec

_SYSTEM_PROMPT = """\
You are a principal engineer performing the final review of a generated project.

You receive the requirement spec and every project file. Return:
- verdict: "approve" (shippable), or "approve_with_findings" (works, but has
  issues worth knowing about).
- findings: concrete issues — security risks, bugs the tests missed, missing
  requirements. Each names the file it concerns. Empty when verdict is
  "approve". Do NOT report style nits.
- readme_markdown: a complete README.md for the project: what it is, setup,
  usage, API overview if applicable. Write for a developer who has never
  seen this codebase.
"""


class ReviewReport(BaseModel):
    """What the LLM returns: verdict, findings, and project README."""

    class Finding(BaseModel):
        file: str = Field(min_length=1)
        issue: str = Field(min_length=1)

    verdict: Literal["approve", "approve_with_findings"]
    findings: tuple[Finding, ...] = ()
    readme_markdown: str = Field(min_length=1)


class ReviewResult(BaseModel):
    """Review outcome plus what it cost."""

    model_config = {"frozen": True}

    report: ReviewReport
    usage: Usage


async def review(
    spec: RequirementSpec,
    file_paths: list[str],
    llm: LLMProvider,
    sandbox: Sandbox,
) -> ReviewResult:
    """Review the whole project; write the README into the workspace."""
    parts = [f"Requirement spec:\n{spec.model_dump_json(indent=2)}", "\nProject files:"]
    for path in file_paths:
        parts.append(f"\n--- {path} ---\n{sandbox.read_file(path)}")

    response = await llm.complete(
        [
            Message(role="system", content=_SYSTEM_PROMPT),
            Message(role="user", content="\n".join(parts)),
        ],
        output_schema=ReviewReport,
    )
    sandbox.write_file("README.md", response.parsed.readme_markdown)
    return ReviewResult(report=response.parsed, usage=response.usage)
