"""Agents: thin prompt-plus-schema wrappers around the LLM port.

An agent here is deliberately small: a system prompt (its expertise), an
output schema (its contract), and a call through LLMProvider. All heavy
lifting — validation, retries, cost — lives in the provider. Judgment lives
in the prompt; structure lives in the schema.
"""
