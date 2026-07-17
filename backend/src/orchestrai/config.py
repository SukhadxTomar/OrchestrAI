"""Application settings.

Single source of configuration truth, loaded once at the composition root and
passed down explicitly — modules never read the environment themselves.
"""

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings (``ORCHESTRAI_`` prefix, ``.env`` supported)."""

    model_config = SettingsConfigDict(
        env_prefix="ORCHESTRAI_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    openrouter_api_key: SecretStr = SecretStr("")
    log_level: str = "INFO"
