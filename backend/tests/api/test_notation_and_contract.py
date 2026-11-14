"""Требования «Обозначения», «API только для чтения», «Машиночитаемое описание контракта»."""

import pytest
from fastapi.testclient import TestClient


def test_notation_has_intro_and_abbreviations_in_content_order(client: TestClient) -> None:
    response = client.get("/api/notation")

    assert response.status_code == 200
    assert response.json() == {
        "intro_markdown": "Заглавная буква — чередующийся звук.",
        "abbreviations": [
            {"code": "МН", "meaning": "множественное число"},
            {"code": "1ЕД", "meaning": "первое лицо"},
            {"code": "ПРИТ", "meaning": "принадлежность"},
            {"code": "МЕСТ", "meaning": "место"},
        ],
    }


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("POST", "/api/topics"),
        ("PUT", "/api/topics/plural-lar"),
        ("PATCH", "/api/topics/plural-lar"),
        ("DELETE", "/api/topics/plural-lar"),
        ("POST", "/api/sections"),
        ("PUT", "/api/notation"),
        ("POST", "/api/graph"),
        ("POST", "/api/search-index"),
    ],
)
def test_modifying_methods_are_rejected(client: TestClient, method: str, url: str) -> None:
    before = client.get("/api/topics").json()

    response = client.request(method, url, json={"title": "Другое название"})

    assert response.status_code == 405
    assert client.get("/api/topics").json() == before


def test_openapi_document_covers_every_operation_and_response_schema(client: TestClient) -> None:
    document = client.get("/api/openapi.json").json()

    def response_schema(path: str) -> dict[str, object]:
        operation = document["paths"][path]["get"]
        schema: dict[str, object] = operation["responses"]["200"]["content"]["application/json"][
            "schema"
        ]
        return schema

    assert document["openapi"].startswith("3.")
    assert set(document["paths"]) == {
        "/api/topics",
        "/api/topics/{id}",
        "/api/sections",
        "/api/notation",
        "/api/graph",
        "/api/search-index",
    }
    assert response_schema("/api/topics")["items"] == {"$ref": "#/components/schemas/TopicSummary"}
    assert response_schema("/api/sections")["items"] == {"$ref": "#/components/schemas/Section"}
    assert response_schema("/api/topics/{id}") == {"$ref": "#/components/schemas/TopicDetail"}
    assert response_schema("/api/notation") == {"$ref": "#/components/schemas/Notation"}
    assert response_schema("/api/graph") == {"$ref": "#/components/schemas/TopicGraph"}
    assert response_schema("/api/search-index")["items"] == {
        "$ref": "#/components/schemas/SearchTopic"
    }
    assert {
        "TopicDetail",
        "Example",
        "ArticleBlock",
        "BlockKind",
        "TopicRef",
        "TopicContrast",
        "GraphEdge",
        "EdgeKind",
        "GraphContrast",
        "SearchTopic",
        "SearchBlock",
        "SearchExample",
    } <= set(document["components"]["schemas"])
    assert document["components"]["schemas"]["EdgeKind"]["enum"] == [
        "prerequisite",
        "member",
        "related",
    ]


def test_openapi_document_describes_only_read_operations(client: TestClient) -> None:
    document = client.get("/api/openapi.json").json()

    methods = {method for operations in document["paths"].values() for method in operations}

    assert methods == {"get"}
