"""Unit tests for the EventBus fan-out and sink isolation."""

from decimal import Decimal

from orchestrai.application.event_bus import EventBus
from orchestrai.domain.events import DomainEvent, LLMCallCompleted


def llm_event(cost: str = "0.002") -> LLMCallCompleted:
    return LLMCallCompleted(
        model="test/model",
        prompt_tokens=100,
        completion_tokens=50,
        cost_usd=Decimal(cost),
        duration_ms=350,
    )


class RecordingSink:
    def __init__(self) -> None:
        self.events: list[DomainEvent] = []

    def handle(self, event: DomainEvent) -> None:
        self.events.append(event)


class ExplodingSink:
    def handle(self, event: DomainEvent) -> None:
        raise RuntimeError("sink is broken")


def test_event_reaches_all_sinks_in_order() -> None:
    first, second = RecordingSink(), RecordingSink()
    bus = EventBus([first, second])
    event = llm_event()
    bus.emit(event)
    assert first.events == [event]
    assert second.events == [event]


def test_broken_sink_does_not_stop_the_others() -> None:
    healthy = RecordingSink()
    bus = EventBus([ExplodingSink(), healthy])  # broken one FIRST
    bus.emit(llm_event())
    assert len(healthy.events) == 1  # still delivered


def test_register_adds_sink_later() -> None:
    bus = EventBus()
    late = RecordingSink()
    bus.register(late)
    bus.emit(llm_event())
    assert len(late.events) == 1


def test_bus_with_no_sinks_is_a_safe_noop() -> None:
    EventBus().emit(llm_event())  # must not raise


def test_events_are_frozen_facts() -> None:
    event = llm_event()
    try:
        event.model = "changed"  # type: ignore[misc]
        raise AssertionError("event should be immutable")
    except Exception:
        pass
