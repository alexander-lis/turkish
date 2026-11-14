"""Требование «Поисковый индекс»."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from tests.support import ContentBuilder
from turkish_grammar.api.app import create_app
from turkish_grammar.settings import Settings

PARTICLE_ARTICLE = """\
## Формула

Частица **dA** стоит после слова, к которому относится: [см. местный падеж](topic:locative-da).

## Подводные камни

### Частица не оглушается

Пишут *kitap da*, а не ~~kitap ta~~.
"""

PARTICLE_EXAMPLES = """\
- tr: Ev*de*yim.
  ru: Я *дома*.
  note: Это аффикс, а не частица.
- tr: Ben *de* geliyorum.
  ru: Я *тоже* иду.
- tr: Kitap da aldım.
  ru: Я купил и книгу.
  source: generated
"""

Json = dict[str, object]


@pytest.fixture
def search_client(content: ContentBuilder) -> Iterator[TestClient]:
    """Справочник из трёх тем: написана только particle-da, она последняя в маршруте."""
    content.topic(
        "vowel-harmony",
        title="Гармония гласных",
        section="phonetics",
        summary="Гласная аффикса подстраивается под слово.",
    )
    content.topic("locative-da", title="Местный падеж -DA")
    content.topic(
        "particle-da",
        title="Частица dA: «тоже»",
        section="particles",
        level="A2",
        article=PARTICLE_ARTICLE,
        examples=PARTICLE_EXAMPLES,
    )

    with TestClient(create_app(Settings(content_dir=content.root))) as test_client:
        yield test_client


def _index(client: TestClient) -> list[Json]:
    response = client.get("/api/search-index")
    assert response.status_code == 200
    index: list[Json] = response.json()
    return index


def _topic(client: TestClient, topic_id: str) -> Json:
    return next(topic for topic in _index(client) if topic["id"] == topic_id)


def test_index_has_every_topic_with_stubs_in_learning_path_order(
    search_client: TestClient,
) -> None:
    assert [topic["id"] for topic in _index(search_client)] == [
        "vowel-harmony",
        "locative-da",
        "particle-da",
    ]


def test_index_topics_carry_the_same_fields_as_topic_list(search_client: TestClient) -> None:
    listed = search_client.get("/api/topics").json()

    for topic, summary in zip(_index(search_client), listed, strict=True):
        assert {field: topic[field] for field in summary} == summary


def test_written_topic_has_its_blocks_with_text_and_its_examples(
    search_client: TestClient,
) -> None:
    topic = _topic(search_client, "particle-da")

    assert topic["blocks"] == [
        {
            "kind": "formula",
            "lines": ["Частица dA стоит после слова, к которому относится: см. местный падеж."],
        },
        {
            "kind": "pitfalls",
            "lines": ["Частица не оглушается", "Пишут kitap da, а не kitap ta."],
        },
    ]
    assert isinstance(topic["examples"], list)
    assert len(topic["examples"]) == 3
    assert topic["section_title"] == "Раздел particles"
    assert topic["is_stub"] is False


def test_stub_has_its_metadata_and_empty_blocks_and_examples(search_client: TestClient) -> None:
    assert _topic(search_client, "vowel-harmony") == {
        "id": "vowel-harmony",
        "title": "Гармония гласных",
        "level": "A1",
        "section_id": "phonetics",
        "section_title": "Раздел phonetics",
        "summary": "Гласная аффикса подстраивается под слово.",
        "is_stub": True,
        "is_overview": False,
        "blocks": [],
        "examples": [],
    }


def test_example_comes_without_emphasis_marks_and_with_its_note(
    search_client: TestClient,
) -> None:
    examples = _topic(search_client, "particle-da")["examples"]

    assert isinstance(examples, list)
    assert examples[0] == {"tr": "Evdeyim.", "ru": "Я дома.", "note": "Это аффикс, а не частица."}


def test_example_without_note_has_no_note(search_client: TestClient) -> None:
    examples = _topic(search_client, "particle-da")["examples"]

    assert isinstance(examples, list)
    assert examples[1] == {"tr": "Ben de geliyorum.", "ru": "Я тоже иду.", "note": None}
