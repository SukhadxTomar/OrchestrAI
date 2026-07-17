"""FakeLLM: a deterministic, zero-cost test double for the LLMProvider port.

Not a mocking-library mock — a real, tiny implementation with controllable
behaviour. Tests queue up responses (or errors) and the fake replays them,
recording every request for assertions.
"""

from decimal import Decimal

from pydantic import BaseModel

from orchestrai.application.ports.llm import LLMError, LLMResponse, Message, Usage

_DEFAULT_USAGE = Usage(prompt_tokens=10, completion_tokens=20, cost_usd=Decimal("0.001"))


class FakeLLM:
    """Replays queued payloads as schema-validated responses, FIFO.

    Each queued item is either:
      * a dict — validated against the requested ``output_schema`` (this also
        makes the fake honest: a fixture that no longer matches the schema
        fails loudly, exactly like a real provider would);
      * an Exception instance — raised instead, to simulate failures.
    """

    def __init__(
        self,
        responses: list[dict[str, object] | Exception] | None = None,
        usage: Usage = _DEFAULT_USAGE,
    ) -> None:
        self._queue: list[dict[str, object] | Exception] = list(responses or [])
        self._usage = usage
        #: Every request received, for test assertions.
        self.calls: list[list[Message]] = []

    def queue(self, item: dict[str, object] | Exception) -> None:
        self._queue.append(item)

    async def complete[SchemaT: BaseModel](
        self,
        messages: list[Message],
        *,
        output_schema: type[SchemaT],
    ) -> LLMResponse[SchemaT]:
        self.calls.append(list(messages))
        if not self._queue:
            raise LLMError("FakeLLM: no queued response for this call")
        item = self._queue.pop(0)
        if isinstance(item, Exception):
            raise item
        return LLMResponse[SchemaT](
            parsed=output_schema.model_validate(item),
            usage=self._usage,
            model="fake-model",
        )
