"""Требования «Различения хранятся отдельным списком», «Различение связывает существующие темы»,
«Набор тем различения не повторяется» и «Тема, где различение разобрано, ссылается на его темы».
"""

from tests.support import ContentBuilder, has_issue
from turkish_grammar.content.model import Contrast

CONTRASTS_FILE = "contrasts.yaml"
EXAMPLES = "- tr: Evde.\n  ru: Дома.\n"


def _topics(content: ContentBuilder, *topic_ids: str) -> None:
    for topic_id in topic_ids:
        content.topic(topic_id)


def _written(content: ContentBuilder, topic_id: str, text: str) -> None:
    content.topic(topic_id, article=f"## Подводные камни\n\n{text}\n", examples=EXAMPLES)


# --- Различения хранятся отдельным списком ---


def test_valid_contrast_is_loaded(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(
        ["locative-da", "particle-da"],
        title="Аффикс -DA и частица dA",
        explained_in=["locative-da"],
    )

    assert content.load().contrasts == (
        Contrast(
            topics=("locative-da", "particle-da"),
            title="Аффикс -DA и частица dA",
            explained_in=("locative-da",),
        ),
    )


def test_contrasts_keep_file_order(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da", "dative-a")
    content.contrast(["locative-da", "particle-da"], title="Первое", explained_in=["dative-a"])
    content.contrast(["dative-a", "locative-da"], title="Второе", explained_in=["dative-a"])

    assert [contrast.title for contrast in content.load().contrasts] == ["Первое", "Второе"]


def test_missing_field_is_reported_with_file_record_and_field(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=["locative-da"])
    content.write(
        CONTRASTS_FILE,
        "- topics: [locative-da, particle-da]\n  title: Первое\n  explained_in: [locative-da]\n"
        "- topics: [particle-da, locative-da]\n  explained_in: [locative-da]\n",
    )

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 2", "нет обязательного поля", "`title`")


def test_unknown_field_is_reported_with_file_record_and_field(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.write(
        CONTRASTS_FILE,
        "- topics: [locative-da, particle-da]\n  title: Первое\n"
        "  explained_in: [locative-da]\n  explained: [particle-da]\n",
    )

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "неизвестное поле", "`explained`")


def test_content_without_contrasts_file_is_loaded_with_no_contrasts(
    content: ContentBuilder,
) -> None:
    _topics(content, "locative-da")

    assert content.load().contrasts == ()


def test_file_that_is_not_a_list_is_reported(content: ContentBuilder) -> None:
    _topics(content, "locative-da")
    content.write(CONTRASTS_FILE, "topics: [locative-da]\n")

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "список")


# --- Различение связывает существующие темы ---


def test_missing_topic_is_reported_with_file_record_and_id(content: ContentBuilder) -> None:
    _topics(content, "locative-da")
    content.contrast(["locative-da", "particle-de"], explained_in=["locative-da"])

    issues = content.issues()

    assert has_issue(
        issues, CONTRASTS_FILE, "запись 1", "`topics`", "particle-de", "такой темы нет"
    )


def test_missing_explaining_topic_is_reported(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=["definitness"])

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "`explained_in`", "definitness")


def test_contrast_with_one_topic_is_reported(content: ContentBuilder) -> None:
    _topics(content, "locative-da")
    content.contrast(["locative-da"], explained_in=["locative-da"])

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "`topics`", "не меньше двух тем")


def test_contrast_without_explaining_topic_is_reported(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=[])

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "`explained_in`", "хотя бы одна тема")


def test_topic_repeated_in_its_list_is_reported(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(
        ["locative-da", "particle-da", "locative-da"], explained_in=["particle-da", "particle-da"]
    )

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "`topics`", "locative-da", "больше одного")
    assert has_issue(
        issues, CONTRASTS_FILE, "запись 1", "`explained_in`", "particle-da", "больше одного"
    )


def test_contrast_may_be_explained_in_third_topic(content: ContentBuilder) -> None:
    _topics(content, "accusative-i", "indefinite-bir", "definiteness")
    content.contrast(["accusative-i", "indefinite-bir"], explained_in=["definiteness"])

    (contrast,) = content.load().contrasts

    assert contrast.explained_in == ("definiteness",)


# --- Набор тем различения не повторяется ---


def test_same_topics_in_another_order_are_reported_with_both_records(
    content: ContentBuilder,
) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=["locative-da"])
    content.contrast(["particle-da", "locative-da"], explained_in=["particle-da"])

    issues = content.issues()

    assert has_issue(issues, CONTRASTS_FILE, "запись 2", "записи 1")
    assert len(issues) == 1


def test_pair_and_triple_sharing_topics_are_loaded(content: ContentBuilder) -> None:
    _topics(content, "locative-ki", "possessive-ki", "conjunction-ki")
    content.contrast(["locative-ki", "possessive-ki"], explained_in=["locative-ki"])
    content.contrast(
        ["locative-ki", "possessive-ki", "conjunction-ki"], explained_in=["locative-ki"]
    )

    assert len(content.load().contrasts) == 2


# --- Тема, где различение разобрано, ссылается на его темы ---


def test_written_explaining_topic_without_link_is_reported(content: ContentBuilder) -> None:
    _topics(content, "particle-da")
    _written(content, "locative-da", "Частица пишется отдельно.")
    content.contrast(["locative-da", "particle-da"], explained_in=["locative-da"])

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "particle-da", "нет ссылки", "запись 1")
    assert len(issues) == 1


def test_written_explaining_topic_with_link_is_loaded(content: ContentBuilder) -> None:
    _topics(content, "particle-da")
    _written(content, "locative-da", "[Частица](topic:particle-da) пишется отдельно.")
    content.contrast(["locative-da", "particle-da"], explained_in=["locative-da"])

    assert len(content.load().contrasts) == 1


def test_explaining_topic_outside_contrast_links_to_every_topic(content: ContentBuilder) -> None:
    _topics(content, "accusative-i", "indefinite-bir")
    _written(content, "definiteness", "Определённость выражает [падеж](topic:accusative-i).")
    content.contrast(["accusative-i", "indefinite-bir"], explained_in=["definiteness"])

    issues = content.issues()

    assert has_issue(issues, "topics/definiteness/topic.md", "indefinite-bir", "нет ссылки")
    assert not has_issue(issues, "topics/definiteness/topic.md", "topic:accusative-i")


def test_stub_explaining_topic_needs_no_links(content: ContentBuilder) -> None:
    _topics(content, "locative-da", "particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=["particle-da"])

    assert len(content.load().contrasts) == 1


def test_written_topic_that_does_not_explain_needs_no_links(content: ContentBuilder) -> None:
    _topics(content, "particle-da")
    _written(content, "locative-da", "Аффикс пишется слитно.")
    content.contrast(["locative-da", "particle-da"], explained_in=["particle-da"])

    assert len(content.load().contrasts) == 1


# --- Общий отчёт ---


def test_contrast_errors_are_reported_together_with_topic_errors(content: ContentBuilder) -> None:
    content.topic("locative-da", level="C1")
    content.topic("particle-da", prerequisites=["no-such-topic"])
    content.contrast(["locative-da", "particle-de"], explained_in=["locative-da"])

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "`level`")
    assert has_issue(issues, "topics/particle-da/topic.md", "no-such-topic")
    assert has_issue(issues, CONTRASTS_FILE, "запись 1", "particle-de")
