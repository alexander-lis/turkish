"""Схемы ответов API. Имена полей в JSON — в snake_case, как здесь."""

from pydantic import BaseModel, ConfigDict

from turkish_grammar.content.model import BlockKind, ExampleSource, Level


class _Schema(BaseModel):
    # Схемы заполняются прямо из объектов предметной модели.
    model_config = ConfigDict(from_attributes=True)


class Section(_Schema):
    id: str
    title: str


class TopicSummary(_Schema):
    id: str
    title: str
    level: Level
    section_id: str
    summary: str
    is_stub: bool


class TopicRef(_Schema):
    """Ссылка на тему, которой клиенту хватает без дополнительного запроса."""

    id: str
    title: str
    is_stub: bool


class ArticleBlock(_Schema):
    kind: BlockKind
    markdown: str


class TextSegment(_Schema):
    text: str
    emphasized: bool


class MarkedText(_Schema):
    """Текст без служебной разметки и его деление на обычные и выделенные отрезки."""

    text: str
    segments: list[TextSegment]


class GlossPart(_Schema):
    text: str
    is_abbreviation: bool


class Morpheme(_Schema):
    form: str
    gloss: str
    parts: list[GlossPart]


class GlossedWord(_Schema):
    morphemes: list[Morpheme]


class Example(_Schema):
    tr: MarkedText
    ru: MarkedText
    source: ExampleSource
    note: str | None
    gloss: list[GlossedWord] | None


class TopicDetail(TopicSummary):
    section: Section
    blocks: list[ArticleBlock]
    examples: list[Example]
    prerequisites: list[TopicRef]
    related: list[TopicRef]
    previous: TopicRef | None
    next: TopicRef | None


class Abbreviation(_Schema):
    code: str
    meaning: str


class Notation(_Schema):
    intro_markdown: str
    abbreviations: list[Abbreviation]


class ErrorResponse(BaseModel):
    detail: str
