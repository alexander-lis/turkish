"""Поисковый индекс: порядок тем, написанная тема, заглушка и тексты примеров."""

import unicodedata

from tests.support import ContentBuilder
from turkish_grammar.content.model import BlockKind, Level
from turkish_grammar.content.search_index import (
    SearchBlock,
    SearchExample,
    SearchTopic,
    build_search_index,
)

ARTICLE = """\
## Формула

Основа + **-DA**. Гласную выбирает [гармония гласных](topic:vowel-harmony).

## Подводные камни

### Частица не оглушается

Пишут *kitapta*, а не ~~kitap ta~~.
"""

EXAMPLES = """\
- tr: Ev*de*yim.
  ru: Я *дома*.
  note: Последняя гласная слова — e.
- tr: Okuldayız.
  ru: Мы в школе.
- tr: Kitap*ta*.
  ru: В книге.
  source: generated
"""


def _index(content: ContentBuilder) -> dict[str, SearchTopic]:
    return {topic.id: topic for topic in build_search_index(content.load())}


def test_index_has_every_topic_in_learning_path_order(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples=EXAMPLES)
    content.topic("vowel-harmony")
    content.topic("plural-lar")
    content.path(["vowel-harmony", "plural-lar", "locative-da"])

    index = build_search_index(content.load())

    assert [topic.id for topic in index] == ["vowel-harmony", "plural-lar", "locative-da"]


def test_written_topic_has_its_blocks_in_order_and_its_examples(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic(
        "locative-da",
        title="Местный падеж -DA",
        level="A2",
        summary="Показывает, где что-то находится.",
        article=ARTICLE,
        examples=EXAMPLES,
    )

    topic = _index(content)["locative-da"]

    assert topic.blocks == (
        SearchBlock(
            kind=BlockKind.FORMULA,
            lines=("Основа + -DA. Гласную выбирает гармония гласных.",),
        ),
        SearchBlock(
            kind=BlockKind.PITFALLS,
            lines=("Частица не оглушается", "Пишут kitapta, а не kitap ta."),
        ),
    )
    assert len(topic.examples) == 3
    assert (topic.title, topic.level, topic.summary) == (
        "Местный падеж -DA",
        Level.A2,
        "Показывает, где что-то находится.",
    )
    assert not topic.is_stub


def test_stub_has_its_metadata_and_no_blocks_or_examples(content: ContentBuilder) -> None:
    content.topic(
        "plural-lar",
        title="Множественное число -lAr",
        section="nouns",
        summary="Показывает, что предметов несколько.",
    )

    assert _index(content)["plural-lar"] == SearchTopic(
        id="plural-lar",
        title="Множественное число -lAr",
        level=Level.A1,
        section_id="nouns",
        section_title="Раздел nouns",
        summary="Показывает, что предметов несколько.",
        is_stub=True,
        is_overview=False,
        blocks=(),
        examples=(),
    )


def test_overview_is_marked(content: ContentBuilder) -> None:
    content.topic("cases-overview", members=["locative-da", "dative-a"])
    content.topic("locative-da")
    content.topic("dative-a")

    index = _index(content)

    assert index["cases-overview"].is_overview
    assert not index["locative-da"].is_overview


def test_example_texts_come_without_emphasis_marks(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("locative-da", article=ARTICLE, examples=EXAMPLES)

    examples = _index(content)["locative-da"].examples

    assert examples[0] == SearchExample(
        tr="Evdeyim.", ru="Я дома.", note="Последняя гласная слова — e."
    )
    assert examples[1] == SearchExample(tr="Okuldayız.", ru="Мы в школе.", note=None)


def test_every_text_of_the_index_is_in_nfc(content: ContentBuilder) -> None:
    def nfd(text: str) -> str:
        return unicodedata.normalize("NFD", text)

    content.topic(
        "conjunction-cunku",
        title=nfd("Союз çünkü"),
        summary=nfd("Объясняет причину: ещё одно предложение."),
        article=nfd("## Формула\n\nСоюз çünkü стоит в начале.\n"),
        examples=nfd("- tr: Çünkü yağmur yağıyor.\n  ru: Потому что идёт дождь.\n  note: Ещё.\n"),
    )

    topic = _index(content)["conjunction-cunku"]

    texts = [
        topic.title,
        topic.summary,
        topic.section_title,
        *(line for block in topic.blocks for line in block.lines),
        *(text for example in topic.examples for text in (example.tr, example.ru, example.note)),
    ]
    assert all(text is not None and unicodedata.is_normalized("NFC", text) for text in texts)
    assert topic.title == "Союз çünkü"
    assert topic.examples[0].tr == "Çünkü yağmur yağıyor."
