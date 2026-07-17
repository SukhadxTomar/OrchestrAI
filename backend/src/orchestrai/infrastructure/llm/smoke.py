"""Live smoke check for the OpenRouter adapter. Costs real (tiny) money.

Not a pytest test — run manually once your .env has an API key:

    uv run python -m orchestrai.infrastructure.llm.smoke
"""

import asyncio

from orchestrai.application.ports.llm import Message
from orchestrai.config import Settings
from orchestrai.domain.models.requirement_spec import RequirementSpec
from orchestrai.infrastructure.llm.openrouter import OpenRouterProvider

_SYSTEM = (
    "You are a requirements analyst. Read the user's project prompt and produce "
    "a RequirementSpec. Mark genuinely unclear decisions as ambiguities: use "
    "kind='resolved' with a sensible default where you can, kind='open' where "
    "a human must choose."
)
_PROMPT = "Build a Todo API using FastAPI with JWT authentication and unit tests."


async def main() -> None:
    settings = Settings()
    provider = OpenRouterProvider(
        api_key=settings.openrouter_api_key.get_secret_value(),
        model=settings.openrouter_model,
    )
    try:
        response = await provider.complete(
            [Message(role="system", content=_SYSTEM), Message(role="user", content=_PROMPT)],
            output_schema=RequirementSpec,
        )
    finally:
        await provider.aclose()

    spec = response.parsed
    print(f"model:    {response.model}")
    print(
        f"cost:     ${response.usage.cost_usd} "
        f"({response.usage.prompt_tokens}+{response.usage.completion_tokens} tokens)"
    )
    print(f"summary:  {spec.summary}")
    print(f"reqs:     {list(spec.functional_requirements)}")
    print(f"stack:    {list(spec.tech_stack)}")
    for amb in spec.ambiguities:
        print(f"ambiguity [{amb.kind}]: {amb.question}")
    print(f"needs human input: {spec.needs_human_input}")


if __name__ == "__main__":
    asyncio.run(main())
