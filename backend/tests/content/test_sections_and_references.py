"""Требования «Раздел из списка разделов» и «Ссылки между темами разрешаются»."""

from tests.support import ContentBuilder, has_issue


def test_sections_keep_file_order(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", section="phonetics")
    content.topic("plural-lar", section="nouns")
    content.sections(["nouns", "phonetics"])

    assert [section.id for section in content.load().sections] == ["nouns", "phonetics"]


def test_topic_with_unknown_section_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", section="nouns")
    content.topic("plural-lar", section="verbs")
    content.sections(["nouns"])

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "раздел", "verbs")


def test_section_without_topics_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", section="nouns")
    content.sections(["nouns", "verbs"])

    issues = content.issues()

    assert has_issue(issues, "sections.yaml", "verbs", "нет ни одной темы")


def test_duplicate_section_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", section="nouns")
    content.sections(["nouns", "nouns"])

    issues = content.issues()

    assert has_issue(issues, "sections.yaml", "nouns", "больше одного раза")


def test_missing_prerequisite_is_reported_with_topic_and_id(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("plural-lar", prerequisites=["vowel-harmoni"])

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "пререквизит", "vowel-harmoni")


def test_missing_related_topic_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar", related=["ablative-dan"])

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "связанная тема", "ablative-dan")


def test_topic_referring_to_itself_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar", prerequisites=["plural-lar"])

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "`prerequisites`", "сама на себя")


def test_repeated_id_in_one_list_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("plural-lar", related=["vowel-harmony", "vowel-harmony"])

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "`related`", "vowel-harmony")


def test_reference_to_topic_with_broken_metadata_is_not_reported_as_missing(
    content: ContentBuilder,
) -> None:
    content.topic("vowel-harmony", level="C1")
    content.topic("plural-lar", prerequisites=["vowel-harmony"])

    issues = content.issues()

    assert not has_issue(issues, "topics/plural-lar/topic.md", "такой темы нет")
