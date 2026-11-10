"""Требования о теме целиком, ссылках на темы, соседях по маршруту, примерах и неизвестной теме."""

from fastapi.testclient import TestClient


def test_written_topic_has_blocks_in_template_order_and_examples(client: TestClient) -> None:
    topic = client.get("/api/topics/vowel-harmony").json()

    assert [block["kind"] for block in topic["blocks"]] == ["formula", "forms"]
    assert (
        topic["blocks"][0]["markdown"] == "Гласная аффикса повторяет ряд последней гласной слова."
    )
    assert topic["blocks"][1]["markdown"].startswith("| Последняя гласная | Аффикс |")
    assert len(topic["examples"]) == 3


def test_topic_has_metadata_and_section_title(client: TestClient) -> None:
    topic = client.get("/api/topics/vowel-harmony").json()

    assert topic["id"] == "vowel-harmony"
    assert topic["title"] == "Гармония гласных"
    assert topic["level"] == "A1"
    assert topic["summary"] == "Гласная аффикса подстраивается под слово."
    assert topic["is_stub"] is False
    assert topic["section_id"] == "phonetics"
    assert topic["section"] == {"id": "phonetics", "title": "Раздел phonetics"}


def test_stub_has_metadata_empty_blocks_and_stub_flag(client: TestClient) -> None:
    topic = client.get("/api/topics/plural-lar").json()

    assert topic["title"] == "Множественное число -lAr"
    assert topic["summary"] == "Показывает, что предметов несколько."
    assert topic["blocks"] == []
    assert topic["examples"] == []
    assert topic["is_stub"] is True


def test_prerequisite_reference_is_self_sufficient(client: TestClient) -> None:
    topic = client.get("/api/topics/plural-lar").json()

    assert topic["prerequisites"] == [
        {"id": "vowel-harmony", "title": "Гармония гласных", "is_stub": False}
    ]


def test_related_reference_is_self_sufficient(client: TestClient) -> None:
    topic = client.get("/api/topics/locative-da").json()

    assert topic["related"] == [
        {"id": "plural-lar", "title": "Множественное число -lAr", "is_stub": True}
    ]


def test_topic_in_the_middle_of_path_has_both_neighbours(client: TestClient) -> None:
    topic = client.get("/api/topics/plural-lar").json()

    assert topic["previous"] == {
        "id": "vowel-harmony",
        "title": "Гармония гласных",
        "is_stub": False,
    }
    assert topic["next"] == {"id": "locative-da", "title": "Местный падеж -DA", "is_stub": True}


def test_first_topic_of_path_has_no_previous(client: TestClient) -> None:
    topic = client.get("/api/topics/vowel-harmony").json()

    assert topic["previous"] is None
    assert topic["next"]["id"] == "plural-lar"


def test_last_topic_of_path_has_no_next(client: TestClient) -> None:
    topic = client.get("/api/topics/passive-il").json()

    assert topic["next"] is None
    assert topic["previous"]["id"] == "locative-da"


def test_example_gloss_is_structured_by_words_and_morphemes(client: TestClient) -> None:
    example = client.get("/api/topics/vowel-harmony").json()["examples"][0]

    (word,) = example["gloss"]
    assert len(word["morphemes"]) == 4
    assert word["morphemes"][0]["form"] == "ev"
    assert word["morphemes"][0]["gloss"] == "дом"
    assert word["morphemes"][-1]["form"] == "de"
    assert word["morphemes"][-1]["gloss"] == "МЕСТ"


def test_gloss_parts_tell_abbreviations_from_lexical_meanings(client: TestClient) -> None:
    example = client.get("/api/topics/vowel-harmony").json()["examples"][0]

    morphemes = example["gloss"][0]["morphemes"]
    assert morphemes[0]["parts"] == [{"text": "дом", "is_abbreviation": False}]
    assert morphemes[2]["gloss"] == "1ЕД.ПРИТ"
    assert morphemes[2]["parts"] == [
        {"text": "1ЕД", "is_abbreviation": True},
        {"text": "ПРИТ", "is_abbreviation": True},
    ]


def test_example_without_gloss_has_no_gloss(client: TestClient) -> None:
    example = client.get("/api/topics/vowel-harmony").json()["examples"][1]

    assert example["gloss"] is None


def test_example_text_comes_without_markup_and_with_emphasized_fragments(
    client: TestClient,
) -> None:
    example = client.get("/api/topics/vowel-harmony").json()["examples"][1]

    assert example["tr"]["text"] == "Evdeyim."
    assert example["tr"]["segments"] == [
        {"text": "Ev", "emphasized": False},
        {"text": "de", "emphasized": True},
        {"text": "yim.", "emphasized": False},
    ]
    assert example["ru"]["text"] == "Я дома."


def test_example_has_source_and_note(client: TestClient) -> None:
    examples = client.get("/api/topics/vowel-harmony").json()["examples"]

    assert [example["source"] for example in examples] == ["authored", "authored", "generated"]
    assert examples[1]["note"] == "Последняя гласная слова — e."
    assert examples[0]["note"] is None


def test_unknown_topic_gives_404_with_machine_readable_error(client: TestClient) -> None:
    response = client.get("/api/topics/no-such-topic")

    assert response.status_code == 404
    assert response.headers["content-type"] == "application/json"
    assert response.json() == {"detail": "Тема «no-such-topic» не найдена"}
