"""Помощники тестов: небольшой каталог контента во временной папке."""

from collections.abc import Sequence
from pathlib import Path

import pytest
import yaml

from turkish_grammar.content.errors import ContentIssue, InvalidContentError
from turkish_grammar.content.loader import load_catalog
from turkish_grammar.content.model import Catalog
from turkish_grammar.content.turkish import turkish_lower

DEFAULT_ABBREVIATIONS = {
    "МН": "множественное число",
    "МЕСТ": "местный падеж",
    "1ЕД": "первое лицо единственного числа",
    "ПРИТ": "притяжательный аффикс",
}


class ContentBuilder:
    """Собирает каталог контента по частям.

    Тема, добавленная через ``topic()``, сама попадает в конец учебного маршрута, а её раздел —
    в список разделов. Чтобы проверить ошибку в этих файлах, их задают явно через
    ``path()`` и ``sections()`` или пишут целиком через ``write()``.
    """

    def __init__(self, root: Path) -> None:
        self.root = root
        self._path: list[str] = []
        self._sections: list[str] = []
        self._auto_path = True
        self._auto_sections = True
        (root / "topics").mkdir(parents=True, exist_ok=True)
        self.abbreviations(DEFAULT_ABBREVIATIONS)
        self.write("notation.md", "Как читать формулы аффиксов и разборы по морфемам.\n")
        self._sync()

    def write(self, rel: str, text: str) -> Path:
        path = self.root / rel
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        return path

    def remove(self, rel: str) -> None:
        (self.root / rel).unlink()

    def topic(
        self,
        topic_id: str,
        *,
        title: str | None = None,
        section: str = "nouns",
        level: str = "A1",
        prerequisites: Sequence[str] = (),
        related: Sequence[str] | None = None,
        summary: str = "Одна фраза о том, что это за явление.",
        article: str = "",
        examples: str | None = None,
        metadata: str | None = None,
    ) -> None:
        """Добавить тему. ``metadata`` заменяет метаданные целиком — для проверки ошибок в них."""
        if metadata is None:
            fields: dict[str, object] = {
                "title": title or f"Тема {topic_id}",
                "section": section,
                "level": level,
                "prerequisites": list(prerequisites),
                "summary": summary,
            }
            if related is not None:
                fields["related"] = list(related)
            metadata = yaml.safe_dump(fields, allow_unicode=True, sort_keys=False)
        self.write(f"topics/{topic_id}/topic.md", f"---\n{metadata.strip()}\n---\n\n{article}")
        if examples is not None:
            self.write(f"topics/{topic_id}/examples.yaml", examples)
        if topic_id not in self._path:
            self._path.append(topic_id)
        if section not in self._sections:
            self._sections.append(section)
        self._sync()

    def path(self, topic_ids: Sequence[str]) -> None:
        self._auto_path = False
        self.write("path.yaml", yaml.safe_dump(list(topic_ids)))

    def sections(self, section_ids: Sequence[str]) -> None:
        self._auto_sections = False
        self._write_sections(section_ids)

    def abbreviations(self, meanings_by_code: dict[str, str]) -> None:
        entries = [{"code": code, "meaning": meaning} for code, meaning in meanings_by_code.items()]
        self.write("abbreviations.yaml", yaml.safe_dump(entries, allow_unicode=True))

    def load(self) -> Catalog:
        return load_catalog(self.root)

    def load_error(self) -> InvalidContentError:
        """Ошибка загрузки. Тест падает, если контент прошёл проверку."""
        with pytest.raises(InvalidContentError) as caught:
            load_catalog(self.root)
        return caught.value

    def issues(self) -> tuple[ContentIssue, ...]:
        return self.load_error().issues

    def _sync(self) -> None:
        if self._auto_path:
            self.write("path.yaml", yaml.safe_dump(self._path))
        if self._auto_sections:
            self._write_sections(self._sections)

    def _write_sections(self, section_ids: Sequence[str]) -> None:
        entries = [
            {"id": section_id, "title": f"Раздел {section_id}"} for section_id in section_ids
        ]
        self.write("sections.yaml", yaml.safe_dump(entries, allow_unicode=True))


class FakeAnalyzer:
    """Подставной анализатор: отвергает только названные слова и помнит, о чём его спрашивали."""

    def __init__(self) -> None:
        self.asked: list[str] = []
        self._rejected: set[str] = set()

    def reject(self, *words: str) -> None:
        self._rejected.update(turkish_lower(word) for word in words)

    def __call__(self, word: str) -> bool:
        self.asked.append(word)
        return turkish_lower(word) not in self._rejected


def has_issue(issues: Sequence[ContentIssue], path: str, *fragments: str) -> bool:
    """Есть ли ошибка в файле ``path``, сообщение которой содержит все ``fragments``."""
    return any(
        issue.path == path and all(fragment in issue.message for fragment in fragments)
        for issue in issues
    )


def report_names(report: str, path: str, *fragments: str) -> bool:
    """Есть ли в отчёте команды строка о файле ``path``, в которой стоят все ``fragments``."""
    return any(
        f"/{path}: " in line and all(fragment in line for fragment in fragments)
        for line in report.splitlines()
    )
