from fastapi.testclient import TestClient

from turkish_grammar.api.app import create_app


def test_openapi_document_is_served_without_loading_content() -> None:
    client = TestClient(create_app())

    response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert response.json()["openapi"].startswith("3.")
