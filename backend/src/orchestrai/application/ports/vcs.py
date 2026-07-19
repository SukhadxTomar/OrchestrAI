"""VCS port: version control over the generated workspace.

One commit per verified task turns a run's git history into an audit trail:
`git log` in the workspace reads as the story of how the project was built.
A port because the backend is volatile (local git today, GitHub PRs later).
"""

from typing import Protocol


class VCS(Protocol):
    """Minimal version-control contract for a workspace."""

    def init(self) -> None:
        """Initialise a repository in the workspace (idempotent)."""
        ...

    def commit_all(self, message: str) -> str | None:
        """Stage everything and commit; return the commit hash.

        Returns None when there is nothing to commit (no changes).
        """
        ...

    def log(self) -> list[str]:
        """Return commit messages, oldest first."""
        ...
