"""Telemetry sinks: where emitted events actually go.

Two adapters for the EventSink port:
  * ConsoleSink — human-readable one-liners for watching a run live.
  * JsonlTraceSink — one JSON object per line, the run's flight recorder.
"""

import sys
from pathlib import Path
from typing import TextIO

from orchestrai.domain.events import DomainEvent, LLMCallCompleted


class ConsoleSink:
    """Prints one compact line per event."""

    def __init__(self, out: TextIO = sys.stdout) -> None:
        self._out = out

    def handle(self, event: DomainEvent) -> None:
        match event:
            case LLMCallCompleted():
                line = (
                    f"[llm] {event.model}  "
                    f"{event.prompt_tokens}+{event.completion_tokens} tok  "
                    f"${event.cost_usd}  {event.duration_ms}ms"
                )
            case _:
                line = f"[event] {type(event).__name__}"
        print(line, file=self._out)


class JsonlTraceSink:
    """Appends every event as one JSON line to a trace file."""

    def __init__(self, path: Path) -> None:
        self._path = path
        path.parent.mkdir(parents=True, exist_ok=True)

    def handle(self, event: DomainEvent) -> None:
        record = event.model_dump_json(exclude_none=True)
        # Type name goes alongside the payload so traces can be filtered.
        line = f'{{"event": "{type(event).__name__}", "data": {record}}}'
        with self._path.open("a", encoding="utf-8") as f:
            f.write(line + "\n")
