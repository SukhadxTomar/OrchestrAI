"""Orchestration: the LangGraph engine that drives a run.

This layer depends on LangGraph directly (a deliberate architecture
decision — the orchestrator is not a volatile boundary). It composes
agents and domain rules into an executable, checkpointable graph.
"""
