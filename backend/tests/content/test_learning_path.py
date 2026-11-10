"""Три требования об учебном маршруте: полнота, порядок пререквизитов, неубывание уровней."""

import pytest

from tests.support import ContentBuilder, has_issue


def test_topics_are_loaded_in_path_order(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.topic("vowel-harmony")
    content.path(["vowel-harmony", "plural-lar"])

    assert [topic.id for topic in content.load().topics] == ["vowel-harmony", "plural-lar"]


def test_topic_missing_from_path_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("dative-a")
    content.path(["vowel-harmony"])

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "dative-a", "не включена")


def test_topic_repeated_in_path_is_reported(content: ContentBuilder) -> None:
    content.topic("dative-a")
    content.path(["dative-a", "dative-a"])

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "dative-a", "2 раза")


def test_unknown_topic_in_path_is_reported(content: ContentBuilder) -> None:
    content.topic("dative-a")
    content.path(["dative-a", "no-such-topic"])

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "no-such-topic", "такой темы нет")


def test_prerequisite_placed_after_topic_is_reported_with_both_topics(
    content: ContentBuilder,
) -> None:
    content.topic("plural-lar", prerequisites=["vowel-harmony"])
    content.topic("vowel-harmony")
    content.path(["plural-lar", "vowel-harmony"])

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "plural-lar", "vowel-harmony", "пререквизита")


@pytest.mark.parametrize("path", [["topic-a", "topic-b"], ["topic-b", "topic-a"]])
def test_mutual_prerequisites_are_reported_in_any_order(
    content: ContentBuilder, path: list[str]
) -> None:
    content.topic("topic-a", prerequisites=["topic-b"])
    content.topic("topic-b", prerequisites=["topic-a"])
    content.path(path)

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "topic-a", "topic-b", "пререквизита")


def test_lower_level_after_higher_level_is_reported_with_both_topics(
    content: ContentBuilder,
) -> None:
    content.topic("passive-il", level="A2")
    content.topic("plural-lar", level="A1")
    content.path(["passive-il", "plural-lar"])

    issues = content.issues()

    assert has_issue(issues, "path.yaml", "plural-lar", "passive-il", "A1", "A2")


def test_equal_and_rising_levels_are_accepted(content: ContentBuilder) -> None:
    content.topic("topic-a", level="A1")
    content.topic("topic-b", level="A1")
    content.topic("topic-c", level="B1")
    content.topic("topic-d", level="B2")

    assert len(content.load().topics) == 4
