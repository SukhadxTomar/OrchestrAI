"""Unit tests for RequirementSpec and the Ambiguity discriminated union."""

import pytest
from pydantic import TypeAdapter, ValidationError

from orchestrai.domain.models.requirement_spec import (
    Ambiguity,
    OpenAmbiguity,
    RequirementSpec,
    ResolvedAmbiguity,
)


def make_spec(**overrides: object) -> RequirementSpec:
    defaults: dict[str, object] = {
        "summary": "A Todo REST API",
        "functional_requirements": ("CRUD todos", "JWT auth"),
    }
    return RequirementSpec(**{**defaults, **overrides})  # type: ignore[arg-type]


class TestDiscriminatedUnion:
    def test_resolved_ambiguity_needs_its_fields(self) -> None:
        with pytest.raises(ValidationError):
            ResolvedAmbiguity(question="Which auth?")  # type: ignore[call-arg]

    def test_open_ambiguity_needs_no_answer(self) -> None:
        amb = OpenAmbiguity(question="Postgres or MySQL?", options=("postgres", "mysql"))
        assert amb.kind == "open"

    def test_union_parses_by_discriminator(self) -> None:
        # Given raw dicts (as an LLM would emit), the tag picks the class.
        adapter = TypeAdapter(Ambiguity)
        resolved = adapter.validate_python(
            {
                "kind": "resolved",
                "question": "Which auth?",
                "chosen_default": "JWT",
                "rationale": "stateless API",
            }
        )
        opened = adapter.validate_python(
            {"kind": "open", "question": "Which DB?", "options": ["pg", "mysql"]}
        )
        assert isinstance(resolved, ResolvedAmbiguity)
        assert isinstance(opened, OpenAmbiguity)

    def test_unknown_discriminator_rejected(self) -> None:
        with pytest.raises(ValidationError):
            TypeAdapter(Ambiguity).validate_python({"kind": "banana", "question": "?"})


class TestSpec:
    def test_minimal_spec_is_valid(self) -> None:
        spec = make_spec()
        assert spec.summary == "A Todo REST API"
        assert not spec.needs_human_input

    def test_empty_summary_rejected(self) -> None:
        with pytest.raises(ValidationError):
            make_spec(summary="")

    def test_open_ambiguities_filtered_out(self) -> None:
        spec = make_spec(
            ambiguities=(
                ResolvedAmbiguity(
                    question="Which auth?", chosen_default="JWT", rationale="stateless"
                ),
                OpenAmbiguity(question="Which DB?", options=("pg", "mysql")),
            )
        )
        opens = spec.open_ambiguities()
        assert len(opens) == 1
        assert opens[0].question == "Which DB?"
        assert spec.needs_human_input

    def test_all_resolved_means_no_human_needed(self) -> None:
        spec = make_spec(
            ambiguities=(
                ResolvedAmbiguity(
                    question="Which auth?", chosen_default="JWT", rationale="stateless"
                ),
            )
        )
        assert not spec.needs_human_input

    def test_spec_round_trips_through_dict(self) -> None:
        # Checkpointing (M4) needs full JSON round-trip, unions included.
        spec = make_spec(ambiguities=(OpenAmbiguity(question="Which DB?", options=("pg",)),))
        restored = RequirementSpec.model_validate(spec.model_dump())
        assert restored == spec
        assert isinstance(restored.ambiguities[0], OpenAmbiguity)
