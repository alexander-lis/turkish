"""Требования «Обзор перечисляет темы своей группы», «Обзор не входит сам в себя»
и «Написанный обзор ссылается на каждую свою тему».
"""

from tests.support import ContentBuilder, has_issue

OVERVIEW_FILE = "topics/cases-overview/topic.md"
EXAMPLES = "- tr: Evde.\n  ru: Дома.\n"


def _cases(content: ContentBuilder) -> None:
    content.topic("locative-da")
    content.topic("dative-a")
    content.topic("genitive-in")


# --- Обзор перечисляет темы своей группы ---


def test_topic_with_members_is_loaded_as_overview(content: ContentBuilder) -> None:
    _cases(content)
    content.topic("cases-overview", members=["locative-da", "dative-a"])

    overview = content.load().topic("cases-overview")

    assert overview.is_overview
    assert overview.members == ("locative-da", "dative-a")


def test_overview_with_one_member_is_reported(content: ContentBuilder) -> None:
    _cases(content)
    content.topic("cases-overview", members=["locative-da"])

    issues = content.issues()

    assert has_issue(issues, OVERVIEW_FILE, "`members`", "не меньше двух тем")


def test_empty_members_list_does_not_make_an_overview(content: ContentBuilder) -> None:
    content.topic("locative-da", members=[])

    assert not content.load().topic("locative-da").is_overview


def test_topic_may_belong_to_two_overviews(content: ContentBuilder) -> None:
    content.topic("past-di")
    content.topic("past-mis")
    content.topic("imperative")
    content.topic("tense-overview", members=["past-di", "past-mis"])
    content.topic("personal-endings-overview", members=["past-di", "imperative"])

    catalog = content.load()

    assert catalog.topic("tense-overview").members == ("past-di", "past-mis")
    assert catalog.topic("personal-endings-overview").members == ("past-di", "imperative")


def test_overview_member_may_be_another_overview(content: ContentBuilder) -> None:
    _cases(content)
    content.topic("cases-overview", members=["locative-da", "dative-a"])
    content.topic("nouns-overview", members=["cases-overview", "genitive-in"])

    assert content.load().topic("nouns-overview").members == ("cases-overview", "genitive-in")


# --- Обзор не входит сам в себя ---


def test_two_overviews_listing_each_other_are_reported_once_with_both_names(
    content: ContentBuilder,
) -> None:
    _cases(content)
    content.topic("cases-overview", members=["locative-da", "nouns-overview"])
    content.topic("nouns-overview", members=["genitive-in", "cases-overview"])

    issues = content.issues()

    assert has_issue(issues, OVERVIEW_FILE, "сам в себя", "cases-overview", "nouns-overview")
    assert len(issues) == 1


def test_overview_listing_itself_through_longer_chain_is_reported(content: ContentBuilder) -> None:
    _cases(content)
    content.topic("a-overview", members=["locative-da", "b-overview"])
    content.topic("b-overview", members=["dative-a", "c-overview"])
    content.topic("c-overview", members=["genitive-in", "a-overview"])

    issues = content.issues()

    assert has_issue(
        issues, "topics/a-overview/topic.md", "«a-overview» → «b-overview» → «c-overview»"
    )
    assert len(issues) == 1


# --- Написанный обзор ссылается на каждую свою тему ---


def test_written_overview_without_link_to_member_is_reported(content: ContentBuilder) -> None:
    _cases(content)
    content.topic(
        "cases-overview",
        members=["locative-da", "genitive-in"],
        article="## Формула\n\nПадежи: [местный](topic:locative-da) и родительный.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, OVERVIEW_FILE, "genitive-in", "нет ссылки")
    assert not has_issue(issues, OVERVIEW_FILE, "«locative-da»")


def test_link_to_member_counts_in_any_block(content: ContentBuilder) -> None:
    _cases(content)
    article = (
        "## Формула\n\nПадежи отвечают на разные вопросы.\n\n"
        "## Формы\n\n| Падеж |\n| --- |\n| [местный](topic:locative-da) |\n\n"
        "## Подводные камни\n\nНе путать с [родительным](topic:genitive-in).\n"
    )
    content.topic(
        "cases-overview",
        members=["locative-da", "genitive-in"],
        article=article,
        examples=EXAMPLES,
    )

    assert not content.load().topic("cases-overview").is_stub


def test_stub_overview_needs_no_links(content: ContentBuilder) -> None:
    _cases(content)
    content.topic("cases-overview", members=["locative-da", "genitive-in"])

    overview = content.load().topic("cases-overview")

    assert overview.is_stub
    assert overview.is_overview
