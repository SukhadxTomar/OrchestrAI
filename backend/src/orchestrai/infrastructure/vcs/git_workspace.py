"""GitPython adapter for the VCS port.

Operates ONLY on the generated workspace passed at construction — never on
the OrchestrAI repository itself.
"""

from pathlib import Path

from git import Actor, Repo

_AUTHOR = Actor("OrchestrAI", "orchestrai@localhost")


class GitWorkspace:
    """Git repository living inside one run's workspace."""

    def __init__(self, workspace: Path) -> None:
        self._path = workspace.resolve()

    def init(self) -> None:
        if not (self._path / ".git").exists():
            Repo.init(self._path)

    def commit_all(self, message: str) -> str | None:
        repo = Repo(self._path)
        repo.git.add(A=True)  # stage everything, deletions included
        # On a fresh repo HEAD doesn't resolve yet — the first commit always
        # proceeds; afterwards, skip when staging produced no changes.
        if repo.head.is_valid() and not repo.index.diff("HEAD"):
            return None
        commit = repo.index.commit(message, author=_AUTHOR, committer=_AUTHOR)
        return commit.hexsha

    def log(self) -> list[str]:
        repo = Repo(self._path)
        if not repo.head.is_valid():
            return []
        return [c.message.strip() for c in repo.iter_commits(reverse=True)]  # type: ignore[misc]
