"""Unit tests for the console and JSONL trace sinks."""

import io
import json
from decimal import Decimal
from pathlib import Path

from orchestrai.domain.events import LLMCallCompleted
from orchestrai.infrastructure.telemetry.sinks import ConsoleSink, JsonlTraceSink


def llm_event() -> LLMCallCompleted:
    return LLMCallCompleted(
        model="test/model",
        prompt_tokens=100,
        completion_tokens=50,
        cost_usd=Decimal("0.002"),
        duration_ms=350,
    )


class TestConsoleSink:
    def test_llm_event_renders_compact_line(self) -> None:
        out = io.StringIO()
        ConsoleSink(out=out).handle(llm_event())
        line = out.getvalue()
        assert "[llm]" in line
        assert "test/model" in line
        assert "$0.002" in line
        assert "350ms" in line


class TestJsonlTraceSink:
    def test_appends_one_json_line_per_event(self, tmp_path: Path) -> None:
        trace = tmp_path / "trace.jsonl"
        sink = JsonlTraceSink(trace)
        sink.handle(llm_event())
        sink.handle(llm_event())

        lines = trace.read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 2
        record = json.loads(lines[0])  # every line must be valid JSON
        assert record["event"] == "LLMCallCompleted"
        assert record["data"]["model"] == "test/model"
        assert "occurred_at" in record["data"]

    def test_creates_parent_directories(self, tmp_path: Path) -> None:
        nested = tmp_path / "deep" / "nested" / "trace.jsonl"
        JsonlTraceSink(nested).handle(llm_event())
        assert nested.exists()
