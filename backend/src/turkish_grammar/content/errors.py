"""Ошибки проверки контента."""

from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class ContentIssue:
    """Одна ошибка: в каком файле и что не так.

    Путь записан относительно каталога контента, сообщение — по-русски.
    """

    path: str
    message: str


def format_issues(heading: str, issues: Iterable[ContentIssue], content_dir: Path) -> str:
    """Отчёт для человека: заголовок и по строке на ошибку, с путём от каталога контента."""
    lines = [heading]
    lines += [f"  {content_dir / issue.path}: {issue.message}" for issue in issues]
    return "\n".join(lines)


class InvalidContentError(Exception):
    """Контент не прошёл проверку. Содержит все найденные ошибки, а не только первую."""

    def __init__(self, issues: Iterable[ContentIssue]) -> None:
        self.issues = tuple(issues)
        super().__init__(f"Контент не прошёл проверку, ошибок: {len(self.issues)}")

    def report(self, content_dir: Path) -> str:
        """Отчёт для человека: по строке на ошибку, с путём к файлу от каталога контента."""
        return format_issues(f"{self}", self.issues, content_dir)


class ContentFormatError(ValueError):
    """Текст нарушает формат контента. Сообщение — готовая фраза для отчёта."""
