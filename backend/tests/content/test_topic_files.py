"""Требования о каталоге темы, её метаданных и уровне из закрытого списка."""

from tests.support import ContentBuilder, has_issue
from turkish_grammar.content.model import Level


def test_valid_topic_is_loaded_with_directory_name_as_id(content: ContentBuilder) -> None:
    content.topic("locative-da", title="Местный падеж -DA")

    topic = content.load().topic("locative-da")

    assert topic.id == "locative-da"
    assert topic.title == "Местный падеж -DA"
    assert topic.level is Level.A1


def test_topic_directory_without_topic_file_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    (content.root / "topics" / "locative-da").mkdir()

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da", "topic.md")


def test_invalid_topic_id_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.write("topics/Locative_DA/topic.md", "---\ntitle: x\n---\n")

    issues = content.issues()

    assert has_issue(issues, "topics/Locative_DA", "идентификатор темы")


def test_missing_required_field_is_reported_with_file_and_field(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        metadata="title: Местный падеж -DA\nsection: nouns\nlevel: A1\nprerequisites: []",
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "нет обязательного поля", "`summary`")


def test_unknown_field_is_reported_with_file_and_field(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        metadata=(
            "title: Местный падеж -DA\nsection: nouns\nlevel: A1\n"
            "prerequisits: []\nprerequisites: []\nsummary: Где что-то находится."
        ),
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "неизвестное поле", "`prerequisits`")


def test_topic_with_empty_prerequisites_is_loaded(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", prerequisites=[])

    assert content.load().topic("vowel-harmony").prerequisites == ()


def test_file_without_metadata_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.write("topics/vowel-harmony/topic.md", "## Формула\n\nТекст.\n")

    issues = content.issues()

    assert has_issue(issues, "topics/vowel-harmony/topic.md", "метаданных")


def test_unexpected_file_in_topic_directory_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.write("topics/vowel-harmony/example.yaml", "[]")

    issues = content.issues()

    assert has_issue(issues, "topics/vowel-harmony/example.yaml", "лишний файл")


def test_level_outside_closed_list_is_reported_with_allowed_levels(content: ContentBuilder) -> None:
    content.topic("locative-da", level="C1")

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "`level`", "C1", "A1, A2, B1, B2")
