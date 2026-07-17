"""M0 smoke tests: the package imports and settings load without a real environment."""

from pydantic import SecretStr

import orchestrai
from orchestrai.config import Settings


def test_package_has_version() -> None:
    assert orchestrai.__version__ == "0.1.0"


def test_settings_load_with_defaults() -> None:
    settings = Settings(_env_file=None)  # ignore any local .env
    assert settings.log_level == "INFO"
    assert settings.openrouter_api_key.get_secret_value() == ""


def test_settings_read_env_prefix(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    monkeypatch.setenv("ORCHESTRAI_LOG_LEVEL", "DEBUG")
    monkeypatch.setenv("ORCHESTRAI_OPENROUTER_API_KEY", "sk-or-test")
    settings = Settings(_env_file=None)
    assert settings.log_level == "DEBUG"
    assert settings.openrouter_api_key == SecretStr("sk-or-test")


def test_secret_is_not_leaked_in_repr() -> None:
    settings = Settings(_env_file=None, openrouter_api_key=SecretStr("sk-or-secret"))
    assert "sk-or-secret" not in repr(settings)
