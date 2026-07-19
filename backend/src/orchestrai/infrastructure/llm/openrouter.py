"""OpenRouter adapter: the real LLMProvider over HTTP.

Flow of one ``complete`` call:
  1. Build an OpenAI-style chat request with ``response_format`` set to the
     JSON Schema of ``output_schema`` (structured outputs).
  2. POST to OpenRouter; transport/HTTP errors surface as ``LLMError``.
  3. Validate the returned JSON against the schema. If validation fails, the
     validation error is appended to the conversation and the model is asked
     to correct itself — up to ``max_parse_retries`` times.
  4. Extract token usage and cost into ``Usage``.

Costs: OpenRouter returns a ``usage.cost`` field (USD) when asked via the
``usage`` request flag, so we don't maintain our own price table.
"""

import json
import time
from decimal import Decimal
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError

from orchestrai.application.event_bus import EventBus
from orchestrai.application.ports.llm import LLMError, LLMResponse, Message, Usage
from orchestrai.domain.events import LLMCallCompleted

_API_URL = "https://openrouter.ai/api/v1/chat/completions"


class OpenRouterProvider:
    """LLMProvider implementation backed by openrouter.ai."""

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        events: EventBus | None = None,
        timeout_s: float = 120.0,
        max_parse_retries: int = 2,
    ) -> None:
        if not api_key:
            raise ValueError("OpenRouter API key is required")
        self._model = model
        self._events = events or EventBus()
        self._max_parse_retries = max_parse_retries
        self._client = httpx.AsyncClient(
            timeout=timeout_s,
            headers={"Authorization": f"Bearer {api_key}"},
        )

    async def complete[SchemaT: BaseModel](
        self,
        messages: list[Message],
        *,
        output_schema: type[SchemaT],
    ) -> LLMResponse[SchemaT]:
        conversation = [m.model_dump() for m in messages]
        total_usage = Usage(prompt_tokens=0, completion_tokens=0, cost_usd=Decimal("0"))
        started = time.monotonic()

        for attempt in range(1 + self._max_parse_retries):
            content, usage = await self._call_api(conversation, output_schema)
            total_usage = _add_usage(total_usage, usage)
            try:
                parsed = output_schema.model_validate_json(content)
            except ValidationError as exc:
                if attempt == self._max_parse_retries:
                    raise LLMError(
                        f"model output failed {output_schema.__name__} validation "
                        f"after {attempt + 1} attempt(s): {exc}"
                    ) from exc
                # Feed the error back so the model can correct itself.
                conversation.append({"role": "assistant", "content": content})
                conversation.append(
                    {
                        "role": "user",
                        "content": (
                            "Your previous response failed schema validation with the "
                            f"following errors:\n{exc}\n"
                            "Respond again with ONLY corrected JSON matching the schema."
                        ),
                    }
                )
                continue
            self._events.emit(
                LLMCallCompleted(
                    model=self._model,
                    prompt_tokens=total_usage.prompt_tokens,
                    completion_tokens=total_usage.completion_tokens,
                    cost_usd=total_usage.cost_usd,
                    duration_ms=int((time.monotonic() - started) * 1000),
                )
            )
            return LLMResponse[SchemaT](parsed=parsed, usage=total_usage, model=self._model)

        raise AssertionError("unreachable")  # loop always returns or raises

    async def _call_api(
        self, conversation: list[dict[str, Any]], output_schema: type[BaseModel]
    ) -> tuple[str, Usage]:
        """One raw API round-trip. Returns (message content, usage)."""
        payload: dict[str, Any] = {
            "model": self._model,
            "messages": conversation,
            "usage": {"include": True},
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": output_schema.__name__,
                    "strict": True,
                    "schema": output_schema.model_json_schema(),
                },
            },
        }
        try:
            response = await self._client.post(_API_URL, json=payload)
            response.raise_for_status()
            body = response.json()
        except httpx.HTTPStatusError as exc:
            raise LLMError(
                f"OpenRouter HTTP {exc.response.status_code}: {exc.response.text[:500]}"
            ) from exc
        except (httpx.HTTPError, json.JSONDecodeError) as exc:
            raise LLMError(f"OpenRouter transport failure: {exc}") from exc

        try:
            content: str = body["choices"][0]["message"]["content"]
            raw_usage = body.get("usage", {})
        except (KeyError, IndexError) as exc:
            raise LLMError(f"unexpected OpenRouter response shape: {body}") from exc

        usage = Usage(
            prompt_tokens=raw_usage.get("prompt_tokens", 0),
            completion_tokens=raw_usage.get("completion_tokens", 0),
            cost_usd=Decimal(str(raw_usage.get("cost", 0))),
        )
        return content, usage

    async def aclose(self) -> None:
        await self._client.aclose()


def _add_usage(a: Usage, b: Usage) -> Usage:
    return Usage(
        prompt_tokens=a.prompt_tokens + b.prompt_tokens,
        completion_tokens=a.completion_tokens + b.completion_tokens,
        cost_usd=a.cost_usd + b.cost_usd,
    )
