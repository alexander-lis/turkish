"""Требования «Обзоры темы и темы обзора», «Различения темы», «Связанные темы не повторяют
другие связи» и «Ссылки на темы самодостаточны» — в части обзоров и различений.
"""

from fastapi.testclient import TestClient


def _topic(client: TestClient, topic_id: str) -> dict[str, list[dict[str, object]]]:
    response = client.get(f"/api/topics/{topic_id}")
    assert response.status_code == 200
    topic: dict[str, list[dict[str, object]]] = response.json()
    return topic


def _ids(refs: object) -> list[object]:
    assert isinstance(refs, list)
    return [ref["id"] for ref in refs]


# --- Обзоры темы и темы обзора ---


def test_topic_of_overview_lists_its_overview_and_has_no_members(linked_client: TestClient) -> None:
    topic = _topic(linked_client, "locative-da")

    assert topic["overviews"] == [
        {"id": "cases-overview", "title": "Обзор падежей", "is_stub": True}
    ]
    assert topic["members"] == []


def test_overview_lists_its_topics_in_content_order(linked_client: TestClient) -> None:
    topic = _topic(linked_client, "cases-overview")

    assert _ids(topic["members"]) == ["accusative-i", "dative-a", "locative-da"]
    assert topic["members"][2] == {
        "id": "locative-da",
        "title": "Местный падеж -DA",
        "is_stub": True,
    }
    assert topic["overviews"] == []


def test_overviews_of_topic_come_in_learning_path_order(linked_client: TestClient) -> None:
    topic = _topic(linked_client, "past-di")

    assert _ids(topic["overviews"]) == ["tense-overview", "personal-endings-overview"]


def test_topic_outside_overviews_has_both_lists_empty(linked_client: TestClient) -> None:
    topic = _topic(linked_client, "vowel-harmony")

    assert topic["overviews"] == []
    assert topic["members"] == []


def test_topic_response_has_overview_flag(linked_client: TestClient) -> None:
    assert linked_client.get("/api/topics/cases-overview").json()["is_overview"] is True
    assert linked_client.get("/api/topics/locative-da").json()["is_overview"] is False


# --- Различения темы ---


def test_topic_gets_contrast_with_other_topics_and_explaining_topics(
    linked_client: TestClient,
) -> None:
    topic = _topic(linked_client, "locative-da")

    assert topic["contrasts"] == [
        {
            "title": "Аффикс -DA и частица dA",
            "topics": [{"id": "particle-da", "title": "Частица dA: «тоже»", "is_stub": True}],
            "explained_in": [{"id": "locative-da", "title": "Местный падеж -DA", "is_stub": True}],
        }
    ]


def test_contrast_of_three_topics_lists_two_other_topics(linked_client: TestClient) -> None:
    (contrast,) = _topic(linked_client, "possessive-ki")["contrasts"]

    assert contrast["title"] == "Три разных ki"
    assert _ids(contrast["topics"]) == ["locative-ki", "conjunction-ki"]
    assert _ids(contrast["explained_in"]) == ["locative-ki"]


def test_contrast_explained_outside_its_topics_names_explaining_topics(
    linked_client: TestClient,
) -> None:
    (contrast,) = _topic(linked_client, "accusative-i")["contrasts"]

    assert _ids(contrast["topics"]) == ["indefinite-bir"]
    assert _ids(contrast["explained_in"]) == ["indefinite-bir", "definiteness"]


def test_topic_that_only_explains_contrast_does_not_get_it(linked_client: TestClient) -> None:
    assert _topic(linked_client, "definiteness")["contrasts"] == []


def test_topic_without_contrasts_has_empty_list(linked_client: TestClient) -> None:
    assert _topic(linked_client, "vowel-harmony")["contrasts"] == []


# --- Связанные темы не повторяют другие связи ---


def test_related_topics_skip_overview_of_topic_and_topics_of_its_contrasts(
    linked_client: TestClient,
) -> None:
    topic = _topic(linked_client, "locative-da")

    assert _ids(topic["related"]) == ["ablative-dan"]
    assert _ids(topic["overviews"]) == ["cases-overview"]


def test_related_topics_keep_topic_that_requires_this_one(linked_client: TestClient) -> None:
    topic = _topic(linked_client, "vowel-harmony")

    assert _ids(topic["related"]) == ["plural-lar"]


def test_related_topics_keep_topic_that_explains_contrast_of_others(
    linked_client: TestClient,
) -> None:
    topic = _topic(linked_client, "definiteness")

    assert _ids(topic["related"]) == ["accusative-i"]
