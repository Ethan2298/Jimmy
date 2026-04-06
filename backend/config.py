import os
from pathlib import Path


class Settings:
    """Application settings loaded from environment variables."""

    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    DATABASE_PATH: str = os.getenv(
        "RPM_DATABASE_PATH",
        str(Path(__file__).parent.parent / "data" / "rpm.db"),
    )
    DEBUG: bool = os.getenv("RPM_DEBUG", "false").lower() == "true"
    HOST: str = os.getenv("RPM_HOST", "0.0.0.0")
    PORT: int = int(os.getenv("RPM_PORT", "8000"))


settings = Settings()
