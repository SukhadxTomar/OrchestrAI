"""EventSink port: the contract every event listener must fulfil.

Sinks are the volatile side of the event system (console today, JSONL file
today, WebSocket later) — so THEY get a port. The bus itself is pure fan-out
logic with no I/O, so it lives as a concrete class in the application layer.
"""

from typing import Protocol

from orchestrai.domain.events import DomainEvent


class EventSink(Protocol):
    """Receives every emitted event. Must never assume it is the only sink."""

    def handle(self, event: DomainEvent) -> None: ...
