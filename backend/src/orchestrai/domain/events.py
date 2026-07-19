"""Domain events: immutable facts about things that happened during a run.

An event is past tense — it records what occurred, it doesn't ask anyone to
do anything. Emitters announce events on the EventBus; sinks (console, trace
file, future WebSocket) subscribe. Emitters never know who is listening.

Only events with a real emitter exist here; new ones are added the moment
their emitter is built.
"""

from datetime import UTC, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


def _now() -> datetime:
    return datetime.now(UTC)


class DomainEvent(BaseModel):
    """Base fact: frozen, timestamped, JSON-serializable."""

    model_config = {"frozen": True}

    occurred_at: datetime = Field(default_factory=_now)


class LLMCallCompleted(DomainEvent):
    """One LLM completion finished (including any internal parse-retries)."""

    model: str
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    cost_usd: Decimal = Field(ge=0)
    duration_ms: int = Field(ge=0)
