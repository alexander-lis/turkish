"""Предметная модель контента: то, что получается из файлов после загрузки и проверки."""

import re
from dataclasses import dataclass, field
from enum import StrEnum

# Идентификаторы тем и разделов: строчные латинские буквы, цифры и дефисы между ними.
ID_PATTERN = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*")


class Level(StrEnum):
    """Уровень CEFR. Порядок значений — порядок изучения."""

    A1 = "A1"
    A2 = "A2"
    B1 = "B1"
    B2 = "B2"


LEVEL_ORDER = {level: position for position, level in enumerate(Level)}


class ExampleSource(StrEnum):
    AUTHORED = "authored"
    GENERATED = "generated"


class BlockKind(StrEnum):
    FORMULA = "formula"
    FORMS = "forms"
    PITFALLS = "pitfalls"
    VS_RUSSIAN = "vs_russian"


# Шаблон текстовой части статьи: какие блоки допустимы в topic.md, в каком порядке
# и под какими заголовками. По этому списку статья и проверяется, и режется на блоки.
ARTICLE_TEMPLATE: tuple[tuple[BlockKind, str], ...] = (
    (BlockKind.FORMULA, "Формула"),
    (BlockKind.FORMS, "Формы"),
    (BlockKind.PITFALLS, "Подводные камни"),
    (BlockKind.VS_RUSSIAN, "Сравнение с русским"),
)


@dataclass(frozen=True)
class ArticleBlock:
    kind: BlockKind
    markdown: str


@dataclass(frozen=True)
class TextSegment:
    text: str
    emphasized: bool


@dataclass(frozen=True)
class MarkedText:
    """Текст примера без служебных звёздочек и его деление на обычные и выделенные отрезки."""

    text: str
    segments: tuple[TextSegment, ...]


@dataclass(frozen=True)
class GlossPart:
    """Часть значения морфемы: обозначение (МН) или лексическое значение (дом)."""

    text: str
    is_abbreviation: bool


@dataclass(frozen=True)
class Morpheme:
    form: str
    parts: tuple[GlossPart, ...]

    @property
    def gloss(self) -> str:
        return ".".join(part.text for part in self.parts)


@dataclass(frozen=True)
class GlossedWord:
    morphemes: tuple[Morpheme, ...]


@dataclass(frozen=True)
class Example:
    tr: MarkedText
    ru: MarkedText
    source: ExampleSource
    note: str | None = None
    gloss: tuple[GlossedWord, ...] | None = None


@dataclass(frozen=True)
class Topic:
    id: str
    title: str
    section_id: str
    level: Level
    summary: str
    prerequisites: tuple[str, ...] = ()
    related: tuple[str, ...] = ()
    members: tuple[str, ...] = ()
    blocks: tuple[ArticleBlock, ...] = ()
    examples: tuple[Example, ...] = ()

    @property
    def is_stub(self) -> bool:
        """Заглушка — тема, к которой ещё не написано ни одного блока статьи."""
        return not self.blocks

    @property
    def is_overview(self) -> bool:
        """Обзор — тема, которая перечисляет темы своей группы."""
        return bool(self.members)


@dataclass(frozen=True)
class Contrast:
    """Различение: темы, явления которых путают, и темы, где различие разобрано."""

    topics: tuple[str, ...]
    title: str
    explained_in: tuple[str, ...]


@dataclass(frozen=True)
class Section:
    id: str
    title: str


@dataclass(frozen=True)
class Abbreviation:
    code: str
    meaning: str


@dataclass(frozen=True)
class KnownWord:
    """Верное слово, которого не знает анализатор, и причина, по которой оно в списке."""

    word: str
    reason: str


@dataclass(frozen=True)
class Catalog:
    """Весь проверенный контент справочника. Темы идут в порядке учебного маршрута."""

    sections: tuple[Section, ...]
    topics: tuple[Topic, ...]
    abbreviations: tuple[Abbreviation, ...]
    notation_markdown: str
    contrasts: tuple[Contrast, ...] = ()
    _positions: dict[str, int] = field(init=False, repr=False, compare=False)
    _sections_by_id: dict[str, Section] = field(init=False, repr=False, compare=False)

    def __post_init__(self) -> None:
        positions = {topic.id: position for position, topic in enumerate(self.topics)}
        object.__setattr__(self, "_positions", positions)
        object.__setattr__(self, "_sections_by_id", {s.id: s for s in self.sections})

    def find_topic(self, topic_id: str) -> Topic | None:
        position = self._positions.get(topic_id)
        return None if position is None else self.topics[position]

    def topic(self, topic_id: str) -> Topic:
        return self.topics[self._positions[topic_id]]

    def section(self, section_id: str) -> Section:
        return self._sections_by_id[section_id]

    def neighbours(self, topic_id: str) -> tuple[Topic | None, Topic | None]:
        """Предыдущая и следующая темы учебного маршрута."""
        position = self._positions[topic_id]
        previous = self.topics[position - 1] if position > 0 else None
        following = self.topics[position + 1] if position + 1 < len(self.topics) else None
        return previous, following
