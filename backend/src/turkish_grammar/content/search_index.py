"""Поисковый индекс: все темы с текстом статей без разметки и примерами. Вычисляется из каталога."""

import unicodedata
from dataclasses import dataclass

from turkish_grammar.content.article import plain_lines
from turkish_grammar.content.model import BlockKind, Catalog, Level, Topic


@dataclass(frozen=True)
class SearchBlock:
    """Текст блока статьи: по строке на абзац, пункт списка, подзаголовок и строку таблицы."""

    kind: BlockKind
    lines: tuple[str, ...]


@dataclass(frozen=True)
class SearchExample:
    """Тексты примера без служебных звёздочек."""

    tr: str
    ru: str
    note: str | None


@dataclass(frozen=True)
class SearchTopic:
    """Запись индекса о теме. У заглушки нет ни блоков, ни примеров."""

    id: str
    title: str
    level: Level
    section_id: str
    section_title: str
    summary: str
    is_stub: bool
    is_overview: bool
    blocks: tuple[SearchBlock, ...]
    examples: tuple[SearchExample, ...]


def build_search_index(catalog: Catalog) -> tuple[SearchTopic, ...]:
    """Построить поисковый индекс: темы в порядке учебного маршрута, все строки в NFC.

    Поиск в браузере сравнивает символ с символом, поэтому буква с диакритикой должна быть
    одним знаком во всех текстах.
    """
    return tuple(_search_topic(topic, catalog) for topic in catalog.topics)


def _search_topic(topic: Topic, catalog: Catalog) -> SearchTopic:
    return SearchTopic(
        id=topic.id,
        title=_nfc(topic.title),
        level=topic.level,
        section_id=topic.section_id,
        section_title=_nfc(catalog.section(topic.section_id).title),
        summary=_nfc(topic.summary),
        is_stub=topic.is_stub,
        is_overview=topic.is_overview,
        blocks=tuple(
            SearchBlock(kind=block.kind, lines=plain_lines(block.markdown))
            for block in topic.blocks
        ),
        examples=tuple(
            SearchExample(
                tr=_nfc(example.tr.text),
                ru=_nfc(example.ru.text),
                note=None if example.note is None else _nfc(example.note),
            )
            for example in topic.examples
        ),
    )


def _nfc(text: str) -> str:
    return unicodedata.normalize("NFC", text)
