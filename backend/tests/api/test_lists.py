"""Требования «Список тем в порядке учебного маршрута» и «Список разделов»."""

from fastapi.testclient import TestClient


def test_topics_come_in_learning_path_order(client: TestClient) -> None:
    response = client.get("/api/topics")

    assert response.status_code == 200
    assert [topic["id"] for topic in response.json()] == [
        "vowel-harmony",
        "plural-lar",
        "locative-da",
        "passive-il",
    ]


def test_topic_summary_has_all_fields(client: TestClient) -> None:
    topics = client.get("/api/topics").json()

    assert topics[1] == {
        "id": "plural-lar",
        "title": "Множественное число -lAr",
        "level": "A1",
        "section_id": "nouns",
        "summary": "Показывает, что предметов несколько.",
        "is_stub": True,
        "is_overview": False,
    }


def test_stub_flag_is_set_only_for_topics_without_article(client: TestClient) -> None:
    topics = {topic["id"]: topic for topic in client.get("/api/topics").json()}

    assert topics["plural-lar"]["is_stub"] is True
    assert topics["vowel-harmony"]["is_stub"] is False


def test_overview_flag_is_set_only_for_topics_with_members(linked_client: TestClient) -> None:
    topics = {topic["id"]: topic for topic in linked_client.get("/api/topics").json()}

    assert topics["cases-overview"]["is_overview"] is True
    assert topics["locative-da"]["is_overview"] is False
    assert sum(topic["is_overview"] for topic in topics.values()) == 3


def test_sections_come_in_content_order(client: TestClient) -> None:
    response = client.get("/api/sections")

    assert response.status_code == 200
    assert response.json() == [
        {"id": "nouns", "title": "Раздел nouns"},
        {"id": "phonetics", "title": "Раздел phonetics"},
        {"id": "verbs", "title": "Раздел verbs"},
    ]
