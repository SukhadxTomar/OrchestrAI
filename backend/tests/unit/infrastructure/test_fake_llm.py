"""Unit tests for the FakeLLM test double."""

import pytest
from pydantic import BaseModel, Field, ValidationError

from orchestrai.application.ports.llm import LLMError, LLMProvider, Message
from orchestrai.infrastructure.llm.fake import FakeLLM


class TinySchema(BaseModel):
    answer: str = Field(min_length=1)


def user(content: str) -> Message:
    return Message(role="user", content=content)


def test_fake_satisfies_the_port_protocol() -> None:
    # Structural typing check: FakeLLM never imports/inherits LLMProvider,
    # yet it IS one because its methods match the contract.
    provider: LLMProvider = FakeLLM()
    assert provider is not None


async def test_replays_queued_responses_in_order() -> None:
    fake = FakeLLM(responses=[{"answer": "first"}, {"answer": "second"}])
    r1 = await fake.complete([user("q1")], output_schema=TinySchema)
    r2 = await fake.complete([user("q2")], output_schema=TinySchema)
    assert r1.parsed.answer == "first"
    assert r2.parsed.answer == "second"


async def test_records_requests_for_assertions() -> None:
    fake = FakeLLM(responses=[{"answer": "x"}])
    await fake.complete([user("what auth?")], output_schema=TinySchema)
    assert fake.calls[0][0].content == "what auth?"


async def test_queued_exception_is_raised() -> None:
    fake = FakeLLM(responses=[LLMError("rate limited")])
    with pytest.raises(LLMError, match="rate limited"):
        await fake.complete([user("q")], output_schema=TinySchema)


async def test_empty_queue_raises() -> None:
    with pytest.raises(LLMError, match="no queued response"):
        await FakeLLM().complete([user("q")], output_schema=TinySchema)


async def test_fixture_must_match_schema() -> None:
    # An honest fake: outdated fixtures fail loudly.
    fake = FakeLLM(responses=[{"wrong_field": "oops"}])
    with pytest.raises(ValidationError):
        await fake.complete([user("q")], output_schema=TinySchema)
