from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.support import ContentBuilder
from turkish_grammar.api.app import create_app
from turkish_grammar.settings import Settings

VOWEL_HARMONY_ARTICLE = """\
## Формула

Гласная аффикса повторяет ряд последней гласной слова.

## Формы

| Последняя гласная | Аффикс |
| ----------------- | ------ |
| a, ı, o, u        | -lar   |
| e, i, ö, ü        | -ler   |
"""

VOWEL_HARMONY_EXAMPLES = """\
- tr: Evlerimde.
  ru: В моих домах.
  morphemes: ev-ler-im-de
  gloss: дом-МН-1ЕД.ПРИТ-МЕСТ
- tr: Ev*de*yim.
  ru: Я *дома*.
  note: Последняя гласная слова — e.
- tr: Kitaplar.
  ru: Книги.
  source: generated
"""


# Учебный маршрут справочника со связями: темы идут в порядке добавления.
LINKED_PATH = [
    "vowel-harmony",
    "plural-lar",
    "cases-overview",
    "accusative-i",
    "dative-a",
    "locative-da",
    "ablative-dan",
    "particle-da",
    "indefinite-bir",
    "definiteness",
    "locative-ki",
    "possessive-ki",
    "conjunction-ki",
    "past-di",
    "past-mis",
    "imperative",
    "tense-overview",
    "personal-endings-overview",
]


@pytest.fixture
def linked_client(content: ContentBuilder) -> Iterator[TestClient]:
    """Сервер со справочником, в котором есть связи всех видов.

    Обзоры: «Обзор падежей» открывает свою группу, «Обзор времён» подводит ей итог,
    а тема past-di входит в два обзора. Различений три: пара, тройка и пара с разбором
    в третьей теме. Написана одна тема — vowel-harmony.
    """
    topics: dict[str, dict[str, list[str]]] = {
        "vowel-harmony": {"related": ["plural-lar"]},
        "plural-lar": {"prerequisites": ["vowel-harmony"]},
        "cases-overview": {"members": ["accusative-i", "dative-a", "locative-da"]},
        "locative-da": {
            "prerequisites": ["vowel-harmony"],
            "related": ["cases-overview", "ablative-dan", "particle-da"],
        },
        "ablative-dan": {"related": ["locative-da"]},
        "definiteness": {"related": ["accusative-i"]},
        "tense-overview": {
            "prerequisites": ["past-di", "past-mis"],
            "members": ["past-di", "past-mis"],
        },
        "personal-endings-overview": {"members": ["imperative", "past-di"]},
    }
    titles = {
        "vowel-harmony": "Гармония гласных",
        "cases-overview": "Обзор падежей",
        "locative-da": "Местный падеж -DA",
        "ablative-dan": "Исходный падеж -DAn",
        "particle-da": "Частица dA: «тоже»",
        "tense-overview": "Обзор времён",
    }
    for topic_id in LINKED_PATH:
        links = topics.get(topic_id, {})
        written = topic_id == "vowel-harmony"
        content.topic(
            topic_id,
            title=titles.get(topic_id),
            prerequisites=links.get("prerequisites", []),
            related=links.get("related"),
            members=links.get("members"),
            article=VOWEL_HARMONY_ARTICLE if written else "",
            examples=VOWEL_HARMONY_EXAMPLES if written else None,
        )
    content.contrast(
        ["locative-da", "particle-da"],
        title="Аффикс -DA и частица dA",
        explained_in=["locative-da"],
    )
    content.contrast(
        ["locative-ki", "possessive-ki", "conjunction-ki"],
        title="Три разных ki",
        explained_in=["locative-ki"],
    )
    content.contrast(
        ["accusative-i", "indefinite-bir"],
        title="kitap, bir kitap, kitabı",
        explained_in=["indefinite-bir", "definiteness"],
    )

    with TestClient(create_app(Settings(content_dir=content.root))) as test_client:
        yield test_client


@pytest.fixture
def client(content: ContentBuilder) -> Iterator[TestClient]:
    """Сервер с небольшим справочником: четыре темы, три раздела.

    Маршрут: vowel-harmony (написана) → plural-lar (заглушка) → locative-da (заглушка)
    → passive-il (заглушка, B1). Разделы в контенте идут в другом порядке, чем в маршруте.
    """
    content.topic(
        "vowel-harmony",
        title="Гармония гласных",
        section="phonetics",
        summary="Гласная аффикса подстраивается под слово.",
        related=["plural-lar"],
        article=VOWEL_HARMONY_ARTICLE,
        examples=VOWEL_HARMONY_EXAMPLES,
    )
    content.topic(
        "plural-lar",
        title="Множественное число -lAr",
        section="nouns",
        prerequisites=["vowel-harmony"],
        summary="Показывает, что предметов несколько.",
    )
    content.topic(
        "locative-da",
        title="Местный падеж -DA",
        section="nouns",
        prerequisites=["vowel-harmony"],
        related=["plural-lar"],
    )
    content.topic("passive-il", title="Страдательный залог -Il", section="verbs", level="B1")
    content.sections(["nouns", "phonetics", "verbs"])
    content.abbreviations(
        {
            "МН": "множественное число",
            "1ЕД": "первое лицо",
            "ПРИТ": "принадлежность",
            "МЕСТ": "место",
        }
    )
    content.write("notation.md", "Заглавная буква — чередующийся звук.\n")

    with TestClient(create_app(Settings(content_dir=content.root))) as test_client:
        yield test_client
