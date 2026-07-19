"""Tests for the GitWorkspace VCS adapter (real git repos in tmp dirs)."""

from pathlib import Path

import pytest

from orchestrai.application.ports.vcs import VCS
from orchestrai.infrastructure.vcs.git_workspace import GitWorkspace


@pytest.fixture()
def workspace(tmp_path: Path) -> Path:
    ws = tmp_path / "ws"
    ws.mkdir()
    return ws


def test_satisfies_the_port_protocol(workspace: Path) -> None:
    vcs: VCS = GitWorkspace(workspace)
    assert vcs is not None


def test_init_is_idempotent(workspace: Path) -> None:
    vcs = GitWorkspace(workspace)
    vcs.init()
    vcs.init()  # second call must not blow up
    assert (workspace / ".git").exists()


def test_commit_per_change_builds_a_log(workspace: Path) -> None:
    vcs = GitWorkspace(workspace)
    vcs.init()

    (workspace / "a.py").write_text("a = 1\n", encoding="utf-8")
    sha1 = vcs.commit_all("t1: scaffold (verified)")
    (workspace / "b.py").write_text("b = 2\n", encoding="utf-8")
    sha2 = vcs.commit_all("t2: routes (verified)")

    assert sha1 is not None and sha2 is not None and sha1 != sha2
    assert vcs.log() == ["t1: scaffold (verified)", "t2: routes (verified)"]


def test_nothing_to_commit_returns_none(workspace: Path) -> None:
    vcs = GitWorkspace(workspace)
    vcs.init()
    (workspace / "a.py").write_text("a = 1\n", encoding="utf-8")
    vcs.commit_all("first")
    assert vcs.commit_all("empty") is None  # no changes since last commit
    assert vcs.log() == ["first"]


def test_log_on_empty_repo_is_empty(workspace: Path) -> None:
    vcs = GitWorkspace(workspace)
    vcs.init()
    assert vcs.log() == []
