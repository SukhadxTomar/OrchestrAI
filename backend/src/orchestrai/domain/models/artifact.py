"""Artifact: a file the platform produced, and which task produced it.

The artifact index is how later tasks know what earlier tasks built: when a
task depends on t1, the coder is shown the files t1 produced. It is also the
run's output manifest — "what did this run generate?"
"""

from pydantic import BaseModel, Field


class Artifact(BaseModel):
    """One produced file, tracked by workspace-relative path."""

    model_config = {"frozen": True}

    path: str = Field(min_length=1)
    task_id: str = Field(min_length=1)
