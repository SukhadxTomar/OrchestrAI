"""Unit tests for the OpenRouter adapter (HTTP mocked with respx)."""

import json
from decimal import Decimal

import httpx
import pytest
import respx
from pydantic import BaseModel, Field

from orchestrai.application.event_bus import EventBus
from orchestrai.application.ports.llm import LLMError, Message
from orchestrai.domain.events import DomainEvent, LLMCallCompleted
from orchestrai.infrastructure.llm.openrouter import _API_URL, OpenRouterProvider


class TinySchema(BaseModel):
    answer: str = Field(min_length=1)


def make_provider(**overrides: object) -> OpenRouterProvider:
    defaults: dict[str, object] = {"api_key": "sk-or-test", "model": "test/model"}
    return OpenRouterProvider(**{**defaults, **overrides})  # type: ignore[arg-type]


def api_response(content: str, cost: float = 0.002) -> dict[str, object]:
    return {
        "choices": [{"message": {"content": content}}],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "cost": cost},
    }


def test_missing_api_key_rejected_at_construction() -> None:
    with pytest.raises(ValueError, match="API key"):
        OpenRouterProvider(api_key="", model="test/model")


@respx.mock
async def test_happy_path_parses_and_accounts_cost() -> None:
    respx.post(_API_URL).respond(json=api_response(json.dumps({"answer": "JWT"})))
    response = await make_provider().complete(
        [Message(role="user", content="which auth?")], output_schema=TinySchema
    )
    assert response.parsed.answer == "JWT"
    assert response.usage.cost_usd == Decimal("0.002")
    assert response.usage.prompt_tokens == 100


@respx.mock
async def test_request_carries_schema_and_auth() -> None:
    route = respx.post(_API_URL).respond(json=api_response(json.dumps({"answer": "x"})))
    await make_provider().complete([Message(role="user", content="q")], output_schema=TinySchema)
    request = route.calls[0].request
    assert request.headers["authorization"] == "Bearer sk-or-test"
    payload = json.loads(request.content)
    assert payload["response_format"]["json_schema"]["name"] == "TinySchema"
    assert payload["usage"] == {"include": True}


@respx.mock
async def test_invalid_json_triggers_correction_retry() -> None:
    # First reply is schema-invalid; adapter must feed the error back and retry.
    route = respx.post(_API_URL)
    route.side_effect = [
        httpx.Response(200, json=api_response('{"wrong_field": "oops"}', cost=0.001)),
        httpx.Response(200, json=api_response(json.dumps({"answer": "fixed"}), cost=0.003)),
    ]
    response = await make_provider().complete(
        [Message(role="user", content="q")], output_schema=TinySchema
    )
    assert response.parsed.answer == "fixed"
    # Usage must accumulate across BOTH attempts — failed calls cost money too.
    assert response.usage.cost_usd == Decimal("0.004")
    # The retry conversation must contain the validation feedback.
    second_payload = json.loads(route.calls[1].request.content)
    assert "failed schema validation" in second_payload["messages"][-1]["content"]


@respx.mock
async def test_gives_up_after_retry_budget() -> None:
    respx.post(_API_URL).respond(json=api_response('{"wrong_field": "oops"}'))
    provider = make_provider(max_parse_retries=1)
    with pytest.raises(LLMError, match="failed TinySchema validation"):
        await provider.complete([Message(role="user", content="q")], output_schema=TinySchema)


@respx.mock
async def test_http_error_becomes_llm_error() -> None:
    respx.post(_API_URL).respond(status_code=429, text="rate limited")
    with pytest.raises(LLMError, match="HTTP 429"):
        await make_provider().complete(
            [Message(role="user", content="q")], output_schema=TinySchema
        )


@respx.mock
async def test_malformed_response_shape_becomes_llm_error() -> None:
    respx.post(_API_URL).respond(json={"unexpected": True})
    with pytest.raises(LLMError, match="unexpected OpenRouter response shape"):
        await make_provider().complete(
            [Message(role="user", content="q")], output_schema=TinySchema
        )


class _RecordingSink:
    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    def handle(self, event: DomainEvent) -> None:
        self.events.append(event)


@respx.mock
async def test_successful_call_emits_llm_call_completed() -> None:
    sink = _RecordingSink()
    provider = make_provider(events=EventBus([sink]))
    respx.post(_API_URL).respond(json=api_response(json.dumps({"answer": "x"})))
    await provider.complete([Message(role="user", content="q")], output_schema=TinySchema)

    assert len(sink.events) == 1
    event = sink.events[0]
    assert isinstance(event, LLMCallCompleted)
    assert event.model == "test/model"
    assert event.cost_usd == Decimal("0.002")


@respx.mock
async def test_failed_call_emits_no_completion_event() -> None:
    sink = _RecordingSink()
    provider = make_provider(events=EventBus([sink]))
    respx.post(_API_URL).respond(status_code=500, text="boom")
    with pytest.raises(LLMError):
        await provider.complete([Message(role="user", content="q")], output_schema=TinySchema)
    assert sink.events == []
