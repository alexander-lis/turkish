"""Требования «Граф тем», «Направление связей графа»
и «Связанная пара не дублирует более определённую связь».
"""

from fastapi.testclient import TestClient

from tests.api.conftest import LINKED_PATH

Edge = dict[str, str]


def _graph(client: TestClient) -> dict[str, list[dict[str, object]]]:
    response = client.get("/api/graph")
    assert response.status_code == 200
    graph: dict[str, list[dict[str, object]]] = response.json()
    return graph


def _edge(kind: str, source: str, target: str) -> Edge:
    return {"kind": kind, "source": source, "target": target}


def _edges_between(client: TestClient, first: str, second: str) -> list[dict[str, object]]:
    return [
        edge
        for edge in _graph(client)["edges"]
        if {edge["source"], edge["target"]} == {first, second}
    ]


# --- Граф тем ---


def test_graph_has_every_topic_in_learning_path_order(linked_client: TestClient) -> None:
    graph = _graph(linked_client)

    assert [topic["id"] for topic in graph["topics"]] == LINKED_PATH


def test_graph_topics_carry_the_same_fields_as_topic_list(linked_client: TestClient) -> None:
    graph = _graph(linked_client)

    assert graph["topics"] == linked_client.get("/api/topics").json()
    assert graph["topics"][2] == {
        "id": "cases-overview",
        "title": "Обзор падежей",
        "level": "A1",
        "section_id": "nouns",
        "summary": "Одна фраза о том, что это за явление.",
        "is_stub": True,
        "is_overview": True,
    }


def test_graph_has_edge_of_every_kind(linked_client: TestClient) -> None:
    edges = _graph(linked_client)["edges"]

    assert _edge("prerequisite", "vowel-harmony", "locative-da") in edges
    assert _edge("member", "cases-overview", "locative-da") in edges
    assert _edge("related", "locative-da", "ablative-dan") in edges


def test_graph_edges_come_in_learning_path_order(linked_client: TestClient) -> None:
    assert _graph(linked_client)["edges"] == [
        _edge("prerequisite", "vowel-harmony", "plural-lar"),
        _edge("prerequisite", "vowel-harmony", "locative-da"),
        _edge("member", "cases-overview", "accusative-i"),
        _edge("member", "cases-overview", "dative-a"),
        _edge("member", "cases-overview", "locative-da"),
        _edge("related", "accusative-i", "definiteness"),
        _edge("related", "locative-da", "ablative-dan"),
        _edge("prerequisite", "past-di", "tense-overview"),
        _edge("prerequisite", "past-mis", "tense-overview"),
        _edge("member", "tense-overview", "past-di"),
        _edge("member", "tense-overview", "past-mis"),
        _edge("member", "personal-endings-overview", "past-di"),
        _edge("member", "personal-endings-overview", "imperative"),
    ]


def test_graph_contrasts_name_topics_by_id_in_content_order(linked_client: TestClient) -> None:
    assert _graph(linked_client)["contrasts"] == [
        {
            "title": "Аффикс -DA и частица dA",
            "topics": ["locative-da", "particle-da"],
            "explained_in": ["locative-da"],
        },
        {
            "title": "Три разных ki",
            "topics": ["locative-ki", "possessive-ki", "conjunction-ki"],
            "explained_in": ["locative-ki"],
        },
        {
            "title": "kitap, bir kitap, kitabı",
            "topics": ["accusative-i", "indefinite-bir"],
            "explained_in": ["indefinite-bir", "definiteness"],
        },
    ]


def test_contrast_of_three_topics_is_not_split_into_pairs(linked_client: TestClient) -> None:
    contrasts = _graph(linked_client)["contrasts"]

    with_ki = [contrast for contrast in contrasts if contrast["title"] == "Три разных ki"]

    assert len(with_ki) == 1
    assert with_ki[0]["topics"] == ["locative-ki", "possessive-ki", "conjunction-ki"]
    assert _edges_between(linked_client, "locative-ki", "possessive-ki") == []


# --- Направление связей графа ---


def test_prerequisite_edge_starts_at_prerequisite(linked_client: TestClient) -> None:
    assert _edges_between(linked_client, "plural-lar", "vowel-harmony") == [
        _edge("prerequisite", "vowel-harmony", "plural-lar")
    ]


def test_member_edge_starts_at_overview(linked_client: TestClient) -> None:
    assert _edges_between(linked_client, "dative-a", "cases-overview") == [
        _edge("member", "cases-overview", "dative-a")
    ]


def test_topics_related_to_each_other_have_one_edge(linked_client: TestClient) -> None:
    assert _edges_between(linked_client, "ablative-dan", "locative-da") == [
        _edge("related", "locative-da", "ablative-dan")
    ]


# --- Связанная пара не дублирует более определённую связь ---


def test_related_topic_that_requires_this_one_has_only_prerequisite_edge(
    linked_client: TestClient,
) -> None:
    kinds = [edge["kind"] for edge in _edges_between(linked_client, "vowel-harmony", "plural-lar")]

    assert kinds == ["prerequisite"]


def test_related_topic_that_is_overview_of_this_one_has_only_member_edge(
    linked_client: TestClient,
) -> None:
    kinds = [
        edge["kind"] for edge in _edges_between(linked_client, "locative-da", "cases-overview")
    ]

    assert kinds == ["member"]


def test_related_topics_of_one_contrast_have_no_edge_but_contrast_is_there(
    linked_client: TestClient,
) -> None:
    assert _edges_between(linked_client, "locative-da", "particle-da") == []
    assert _graph(linked_client)["contrasts"][0]["topics"] == ["locative-da", "particle-da"]


def test_overview_that_requires_its_topics_has_both_edges(linked_client: TestClient) -> None:
    assert _edges_between(linked_client, "tense-overview", "past-di") == [
        _edge("prerequisite", "past-di", "tense-overview"),
        _edge("member", "tense-overview", "past-di"),
    ]
