"""Сводка наполнения: сколько тем написано на каждом уровне и сколько примеров у написанных тем."""

from collections.abc import Sequence
from dataclasses import dataclass

from turkish_grammar.content.model import Catalog, Level


@dataclass(frozen=True)
class LevelSummary:
    level: Level
    topics: int
    written: int

    @property
    def stubs(self) -> int:
        return self.topics - self.written


@dataclass(frozen=True)
class WrittenTopicSummary:
    topic_id: str
    level: Level
    examples: int
    glossed_examples: int


@dataclass(frozen=True)
class ContentSummary:
    """Уровни идут в порядке изучения, написанные темы — в порядке учебного маршрута."""

    levels: tuple[LevelSummary, ...]
    written_topics: tuple[WrittenTopicSummary, ...]


def summarize(catalog: Catalog) -> ContentSummary:
    levels = tuple(
        LevelSummary(
            level=level,
            topics=sum(topic.level == level for topic in catalog.topics),
            written=sum(topic.level == level and not topic.is_stub for topic in catalog.topics),
        )
        for level in Level
    )
    written_topics = tuple(
        WrittenTopicSummary(
            topic_id=topic.id,
            level=topic.level,
            examples=len(topic.examples),
            glossed_examples=sum(example.gloss is not None for example in topic.examples),
        )
        for topic in catalog.topics
        if not topic.is_stub
    )
    return ContentSummary(levels=levels, written_topics=written_topics)


def format_summary(summary: ContentSummary) -> str:
    """Сводка для человека: таблица уровней и таблица написанных тем."""
    level_rows: list[Sequence[str | int]] = [("Уровень", "Тем", "Написано", "Заглушек")]
    level_rows += [(row.level, row.topics, row.written, row.stubs) for row in summary.levels]
    level_rows.append(
        (
            "Всего",
            sum(row.topics for row in summary.levels),
            sum(row.written for row in summary.levels),
            sum(row.stubs for row in summary.levels),
        )
    )
    if not summary.written_topics:
        return f"{_table(level_rows)}\n\nНаписанных тем нет."

    topic_rows: list[Sequence[str | int]] = [
        ("Написанная тема", "Уровень", "Примеров", "С разбором")
    ]
    topic_rows += [
        (topic.topic_id, topic.level, topic.examples, topic.glossed_examples)
        for topic in summary.written_topics
    ]
    return f"{_table(level_rows)}\n\n{_table(topic_rows)}"


def _table(rows: Sequence[Sequence[str | int]]) -> str:
    """Выровнять столбцы: с числами — по правому краю, с текстом — по левому.

    Первая строка — заголовки столбцов.
    """
    numeric = [isinstance(cell, int) for cell in rows[1]]
    cells = [[str(cell) for cell in row] for row in rows]
    widths = [max(len(row[column]) for row in cells) for column in range(len(numeric))]
    lines = []
    for row in cells:
        aligned = [
            cell.rjust(width) if is_number else cell.ljust(width)
            for cell, width, is_number in zip(row, widths, numeric, strict=True)
        ]
        lines.append("  ".join(aligned).rstrip())
    return "\n".join(lines)
