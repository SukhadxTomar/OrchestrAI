"""RequirementSpec: the Analyst agent's structured reading of a user prompt.

A raw prompt ("Build a Todo API with auth") becomes a typed spec: what to
build, under what constraints, on what stack — plus the *ambiguities* the
Analyst found. Each ambiguity is either already resolved (the Analyst picked
a sensible default) or still open (a human must decide). These two shapes are
modelled as a discriminated union, so an ambiguity can never be in an
inconsistent in-between state.
"""

from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ResolvedAmbiguity(BaseModel):
    """An ambiguity the Analyst decided on its own, with a stated rationale."""

    model_config = {"frozen": True}

    kind: Literal["resolved"] = "resolved"
    question: str = Field(min_length=1)
    chosen_default: str = Field(min_length=1)
    rationale: str = Field(min_length=1)


class OpenAmbiguity(BaseModel):
    """An ambiguity the Analyst could not resolve — a human must choose."""

    model_config = {"frozen": True}

    kind: Literal["open"] = "open"
    question: str = Field(min_length=1)
    options: tuple[str, ...] = ()


#: One ambiguity, discriminated on its ``kind`` tag.
Ambiguity = Annotated[
    ResolvedAmbiguity | OpenAmbiguity,
    Field(discriminator="kind"),
]


class RequirementSpec(BaseModel):
    """The typed output of requirement analysis for a single run."""

    model_config = {"frozen": True}

    summary: str = Field(min_length=1)
    functional_requirements: tuple[str, ...]
    constraints: tuple[str, ...] = ()
    tech_stack: tuple[str, ...] = ()
    ambiguities: tuple[Ambiguity, ...] = ()

    def open_ambiguities(self) -> tuple[OpenAmbiguity, ...]:
        """Ambiguities that require human input before work can proceed.

        Used at the approval gate (M4): a non-empty result means the graph
        must interrupt and ask the human to decide.
        """
        return tuple(a for a in self.ambiguities if isinstance(a, OpenAmbiguity))

    @property
    def needs_human_input(self) -> bool:
        return bool(self.open_ambiguities())
