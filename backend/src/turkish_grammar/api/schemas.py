"""Схемы ответов API. Имена полей в JSON — в snake_case, как здесь."""

from pydantic import BaseModel, ConfigDict

from turkish_grammar.content.graph import EdgeKind
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
    is_overview: bool


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


class TopicContrast(_Schema):
    """Различение в ответе о теме: остальные его темы и темы, где различие разобрано."""

    title: str
    topics: list[TopicRef]
    explained_in: list[TopicRef]


class TopicDetail(TopicSummary):
    section: Section
    blocks: list[ArticleBlock]
    examples: list[Example]
    prerequisites: list[TopicRef]
    overviews: list[TopicRef]
    members: list[TopicRef]
    contrasts: list[TopicContrast]
    related: list[TopicRef]
    previous: TopicRef | None
    next: TopicRef | None


class GraphEdge(_Schema):
    """Связь графа тем: у пререквизита начало — пререквизит, у темы обзора — обзор."""

    kind: EdgeKind
    source: str
    target: str


class GraphContrast(_Schema):
    """Различение в графе тем: темы названы идентификаторами."""

    title: str
    topics: list[str]
    explained_in: list[str]


class TopicGraph(_Schema):
    topics: list[TopicSummary]
    edges: list[GraphEdge]
    contrasts: list[GraphContrast]


class SearchBlock(_Schema):
    """Текст блока статьи без разметки Markdown, по строкам."""

    kind: BlockKind
    lines: list[str]


class SearchExample(_Schema):
    """Тексты примера без служебных звёздочек."""

    tr: str
    ru: str
    note: str | None


class SearchTopic(TopicSummary):
    """Запись поискового индекса: всё, что о теме ищет и показывает окно поиска."""

    section_title: str
    blocks: list[SearchBlock]
    examples: list[SearchExample]


class Abbreviation(_Schema):
    code: str
    meaning: str


class Notation(_Schema):
    intro_markdown: str
    abbreviations: list[Abbreviation]


class ErrorResponse(BaseModel):
    detail: str
