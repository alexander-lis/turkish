"""Граф тем: связи каждого вида, их направление и порядок, обратные индексы темы."""

import pytest

from tests.support import ContentBuilder
from turkish_grammar.content.graph import Edge, EdgeKind, TopicGraph, build_graph


def _graph(content: ContentBuilder) -> TopicGraph:
    return build_graph(content.load())


def _edges(content: ContentBuilder, kind: EdgeKind) -> list[tuple[str, str]]:
    return [(edge.source, edge.target) for edge in _graph(content).edges if edge.kind is kind]


# --- Связь каждого вида и её направление ---


def test_prerequisite_edge_goes_from_prerequisite_to_topic_that_requires_it(
    content: ContentBuilder,
) -> None:
    content.topic("vowel-harmony")
    content.topic("plural-lar", prerequisites=["vowel-harmony"])

    assert _graph(content).edges == (Edge(EdgeKind.PREREQUISITE, "vowel-harmony", "plural-lar"),)


def test_member_edge_goes_from_overview_to_its_topic(content: ContentBuilder) -> None:
    content.topic("cases-overview", members=["locative-da", "dative-a"])
    content.topic("locative-da")
    content.topic("dative-a")

    assert _graph(content).edges == (
        Edge(EdgeKind.MEMBER, "cases-overview", "locative-da"),
        Edge(EdgeKind.MEMBER, "cases-overview", "dative-a"),
    )


def test_related_edge_starts_at_topic_that_comes_first_in_learning_path(
    content: ContentBuilder,
) -> None:
    content.topic("locative-da")
    content.topic("ablative-dan", related=["locative-da"])

    assert _graph(content).edges == (Edge(EdgeKind.RELATED, "locative-da", "ablative-dan"),)


def test_topics_related_to_each_other_give_one_edge(content: ContentBuilder) -> None:
    content.topic("locative-da", related=["ablative-dan"])
    content.topic("ablative-dan", related=["locative-da"])

    assert _edges(content, EdgeKind.RELATED) == [("locative-da", "ablative-dan")]


def test_topic_has_edge_of_every_kind(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("cases-overview", members=["locative-da", "ablative-dan"])
    content.topic("locative-da", prerequisites=["vowel-harmony"], related=["ablative-dan"])
    content.topic("ablative-dan")

    edges = _graph(content).edges

    assert Edge(EdgeKind.PREREQUISITE, "vowel-harmony", "locative-da") in edges
    assert Edge(EdgeKind.MEMBER, "cases-overview", "locative-da") in edges
    assert Edge(EdgeKind.RELATED, "locative-da", "ablative-dan") in edges


# --- Связанная тема уступает более определённой связи ---


@pytest.mark.parametrize("listing", ["vowel-harmony", "plural-lar"])
def test_no_related_edge_between_topic_and_its_prerequisite(
    content: ContentBuilder, listing: str
) -> None:
    other = "plural-lar" if listing == "vowel-harmony" else "vowel-harmony"
    related = {listing: [other]}
    content.topic("vowel-harmony", related=related.get("vowel-harmony"))
    content.topic("plural-lar", prerequisites=["vowel-harmony"], related=related.get("plural-lar"))

    assert _graph(content).edges == (Edge(EdgeKind.PREREQUISITE, "vowel-harmony", "plural-lar"),)


@pytest.mark.parametrize("listing", ["cases-overview", "locative-da"])
def test_no_related_edge_between_overview_and_its_topic(
    content: ContentBuilder, listing: str
) -> None:
    other = "locative-da" if listing == "cases-overview" else "cases-overview"
    related = {listing: [other]}
    content.topic(
        "cases-overview",
        members=["locative-da", "dative-a"],
        related=related.get("cases-overview"),
    )
    content.topic("locative-da", related=related.get("locative-da"))
    content.topic("dative-a")

    assert _edges(content, EdgeKind.RELATED) == []
    assert ("cases-overview", "locative-da") in _edges(content, EdgeKind.MEMBER)


def test_no_related_edge_between_topics_of_one_contrast(content: ContentBuilder) -> None:
    content.topic("locative-ki", related=["conjunction-ki", "locative-da"])
    content.topic("possessive-ki")
    content.topic("conjunction-ki")
    content.topic("locative-da")
    content.contrast(
        ["locative-ki", "possessive-ki", "conjunction-ki"], explained_in=["locative-da"]
    )

    assert _edges(content, EdgeKind.RELATED) == [("locative-ki", "locative-da")]


def test_topic_that_only_explains_contrast_keeps_its_related_edges(
    content: ContentBuilder,
) -> None:
    content.topic("accusative-i")
    content.topic("indefinite-bir")
    content.topic("definiteness", related=["accusative-i"])
    content.contrast(["accusative-i", "indefinite-bir"], explained_in=["definiteness"])

    assert _edges(content, EdgeKind.RELATED) == [("accusative-i", "definiteness")]


# --- Порядок связей ---


def test_edges_follow_learning_path_of_source_then_of_target(content: ContentBuilder) -> None:
    content.topic("dative-a", prerequisites=["vowel-harmony"], related=["locative-da"])
    content.topic("locative-da", prerequisites=["vowel-harmony", "buffer-consonants"])
    content.topic("buffer-consonants", prerequisites=["vowel-harmony"])
    content.topic("vowel-harmony")
    content.path(["vowel-harmony", "buffer-consonants", "locative-da", "dative-a"])

    assert [(edge.source, edge.target) for edge in _graph(content).edges] == [
        ("vowel-harmony", "buffer-consonants"),
        ("vowel-harmony", "locative-da"),
        ("vowel-harmony", "dative-a"),
        ("buffer-consonants", "locative-da"),
        ("locative-da", "dative-a"),
    ]


def test_edges_of_different_kinds_between_same_topics_keep_kind_order(
    content: ContentBuilder,
) -> None:
    content.topic("cases-overview", members=["locative-da", "dative-a"])
    content.topic("locative-da", prerequisites=["cases-overview"])
    content.topic("dative-a")

    assert _graph(content).edges[:2] == (
        Edge(EdgeKind.PREREQUISITE, "cases-overview", "locative-da"),
        Edge(EdgeKind.MEMBER, "cases-overview", "locative-da"),
    )


def test_edges_keep_their_order_when_graph_is_built_again(content: ContentBuilder) -> None:
    topic_ids = [f"topic-{number}" for number in range(12)]
    for number, topic_id in enumerate(topic_ids):
        content.topic(
            topic_id,
            prerequisites=topic_ids[:number][-2:],
            related=[other for other in topic_ids[::3] if other != topic_id],
        )
    catalog = content.load()

    assert build_graph(catalog).edges == build_graph(catalog).edges
    assert build_graph(content.load()).edges == build_graph(catalog).edges


# --- Обзоры темы ---


def test_overviews_of_topic_follow_learning_path(content: ContentBuilder) -> None:
    content.topic("past-di")
    content.topic("past-mis")
    content.topic("imperative")
    content.topic("tense-overview", members=["past-di", "past-mis"])
    content.topic("personal-endings-overview", members=["imperative", "past-di"])
    content.path(
        ["past-di", "imperative", "personal-endings-overview", "past-mis", "tense-overview"]
    )

    graph = _graph(content)

    assert graph.overviews_of("past-di") == ("personal-endings-overview", "tense-overview")
    assert graph.overviews_of("past-mis") == ("tense-overview",)
    assert graph.overviews_of("tense-overview") == ()


# --- Различения темы ---


def test_contrasts_of_topic_come_in_content_order(content: ContentBuilder) -> None:
    for topic_id in ("locative-da", "particle-da", "dative-a"):
        content.topic(topic_id)
    content.contrast(["dative-a", "locative-da"], title="Куда и где", explained_in=["dative-a"])
    content.contrast(
        ["locative-da", "particle-da"], title="Аффикс и частица", explained_in=["locative-da"]
    )

    graph = _graph(content)

    assert [c.title for c in graph.contrasts_of("locative-da")] == [
        "Куда и где",
        "Аффикс и частица",
    ]
    assert [c.title for c in graph.contrasts_of("particle-da")] == ["Аффикс и частица"]


def test_topic_that_only_explains_contrast_does_not_get_it(content: ContentBuilder) -> None:
    for topic_id in ("accusative-i", "indefinite-bir", "definiteness"):
        content.topic(topic_id)
    content.contrast(["accusative-i", "indefinite-bir"], explained_in=["definiteness"])

    graph = _graph(content)

    assert graph.contrasts_of("definiteness") == ()
    assert len(graph.contrasts_of("accusative-i")) == 1


# --- Связанные темы без повторов ---


def test_related_of_topic_drops_topics_shown_by_another_link(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic("cases-overview", members=["locative-da", "dative-a"])
    content.topic(
        "locative-da",
        prerequisites=["vowel-harmony"],
        related=["cases-overview", "ablative-dan", "vowel-harmony", "particle-da", "dative-a"],
    )
    content.topic("dative-a")
    content.topic("ablative-dan")
    content.topic("particle-da")
    content.contrast(["locative-da", "particle-da"], explained_in=["locative-da"])

    graph = _graph(content)

    assert graph.related_of("locative-da") == ("ablative-dan", "dative-a")


def test_related_of_overview_drops_its_topics(content: ContentBuilder) -> None:
    content.topic(
        "cases-overview",
        members=["locative-da", "dative-a"],
        related=["locative-da", "verb-government", "dative-a"],
    )
    content.topic("locative-da")
    content.topic("dative-a")
    content.topic("verb-government")

    assert _graph(content).related_of("cases-overview") == ("verb-government",)


def test_related_of_topic_keeps_topic_that_requires_it(content: ContentBuilder) -> None:
    content.topic("vowel-harmony", related=["plural-lar"])
    content.topic("plural-lar", prerequisites=["vowel-harmony"])

    graph = _graph(content)

    assert graph.related_of("vowel-harmony") == ("plural-lar",)
    assert _edges(content, EdgeKind.RELATED) == []
