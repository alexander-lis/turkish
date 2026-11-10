"""Настройки сервера. Читаются из переменных окружения."""

from pathlib import Path

from pydantic_settings import BaseSettings

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    # Каталог контента; переопределяется переменной окружения CONTENT_DIR.
    content_dir: Path = REPO_ROOT / "content"
