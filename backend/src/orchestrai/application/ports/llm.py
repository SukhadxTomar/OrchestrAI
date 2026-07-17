"""LLM port: the contract every model provider must fulfil.

The application (agents, services) talks to language models ONLY through
``LLMProvider``. Which vendor sits behind it — OpenRouter, a fake in tests,
a future replay recorder — is an infrastructure detail this layer never sees
(dependency inversion).

Design notes:
  * ``complete`` takes an ``output_schema`` (a Pydantic model class) and the
    provider returns a response whose ``parsed`` attribute is a validated
    instance of it. Schema enforcement is the provider's job, because the
    retry-on-bad-JSON loop needs the raw LLM response, which only the
    provider has.
  * ``Usage`` carries token counts and cost so every call can feed
    ``Budget.record_spend`` — cost is part of the contract, not an
    afterthought.
"""

from decimal import Decimal
from typing import Literal, Protocol

from pydantic import BaseModel, Field


class Message(BaseModel):
    """One chat message. Roles mirror the OpenAI-style wire format."""

    model_config = {"frozen": True}

    role: Literal["system", "user", "assistant"]
    content: str


class Usage(BaseModel):
    """Token and cost accounting for a single completion."""

    model_config = {"frozen": True}

    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    cost_usd: Decimal = Field(ge=0)


class LLMResponse[SchemaT: BaseModel](BaseModel):
    """A completed call: the validated object plus what it cost.

    Generic over the schema type, so ``complete(..., output_schema=RequirementSpec)``
    gives an ``LLMResponse[RequirementSpec]`` and ``.parsed`` is fully typed.
    """

    model_config = {"frozen": True}

    parsed: SchemaT
    usage: Usage
    model: str


class LLMError(Exception):
    """Provider failure: network, auth, rate limit, or unparseable output.

    Deliberately NOT a DomainError — this is an infrastructure failure,
    not a business rule violation. Callers decide whether to retry or halt.
    """


class LLMProvider(Protocol):
    """Structural contract for model providers (no inheritance required)."""

    async def complete[SchemaT: BaseModel](
        self,
        messages: list[Message],
        *,
        output_schema: type[SchemaT],
    ) -> LLMResponse[SchemaT]:
        """Run one completion and return schema-validated output.

        Raises:
            LLMError: on transport failure or if the model cannot produce
                schema-valid output within the provider's retry budget.
        """
        ...
