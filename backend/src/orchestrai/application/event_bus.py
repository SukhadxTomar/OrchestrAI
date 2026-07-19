"""EventBus: fans every emitted event out to all registered sinks.

Pure in-process logic, no I/O — which is why it is a concrete application
class, not a port. A failing sink is isolated: observability must never
crash the run it is observing.
"""

import logging

from orchestrai.application.ports.events import EventSink
from orchestrai.domain.events import DomainEvent

_log = logging.getLogger(__name__)


class EventBus:
    """Synchronous fan-out to sinks, in registration order."""

    def __init__(self, sinks: list[EventSink] | None = None) -> None:
        self._sinks: list[EventSink] = list(sinks or [])

    def register(self, sink: EventSink) -> None:
        self._sinks.append(sink)

    def emit(self, event: DomainEvent) -> None:
        for sink in self._sinks:
            try:
                sink.handle(event)
            except Exception:  # a broken sink must never kill the run it observes
                _log.exception("event sink %r failed; continuing", sink)
