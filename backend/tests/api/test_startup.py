"""Требование «Невалидный контент не показывается читателю»: поведение сервера при старте."""

import pytest
from fastapi.testclient import TestClient

from tests.support import ContentBuilder, has_issue
from turkish_grammar.api.app import create_app
from turkish_grammar.content.errors import InvalidContentError
from turkish_grammar.settings import Settings


def test_server_refuses_to_start_with_invalid_content_and_reports_every_error(
    content: ContentBuilder, caplog: pytest.LogCaptureFixture
) -> None:
    content.topic("plural-lar", level="C1")
    content.topic(
        "locative-da",
        article="## Заметки\n\nТекст.\n",
        examples="- tr: Evdeyim.\n  ru: Я дома.\n",
    )
    app = create_app(Settings(content_dir=content.root))

    with pytest.raises(InvalidContentError) as caught, TestClient(app):
        pass

    assert has_issue(caught.value.issues, "topics/plural-lar/topic.md", "`level`")
    assert has_issue(caught.value.issues, "topics/locative-da/topic.md", "неизвестный блок")
    assert "topics/plural-lar/topic.md: " in caplog.text
    assert "topics/locative-da/topic.md: " in caplog.text


def test_server_starts_with_valid_content(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    app = create_app(Settings(content_dir=content.root))

    with TestClient(app) as client:
        response = client.get("/api/openapi.json")

    assert response.status_code == 200
    assert [topic.id for topic in app.state.catalog.topics] == ["vowel-harmony"]


def test_server_starts_when_content_has_unrecognized_word(content: ContentBuilder) -> None:
    """Требование «Проверка словоформ не блокирует сервер»."""
    content.topic(
        "plural-lar",
        article="## Формула\n\nОснова и аффикс.\n",
        examples="- tr: Kitaplerde resim var.\n  ru: В книгах есть картинки.\n",
    )
    app = create_app(Settings(content_dir=content.root))

    with TestClient(app) as client:
        response = client.get("/api/topics/plural-lar")

    assert response.status_code == 200
    assert response.json()["examples"][0]["tr"]["text"] == "Kitaplerde resim var."


def test_content_directory_comes_from_environment(
    content: ContentBuilder, monkeypatch: pytest.MonkeyPatch
) -> None:
    content.topic("vowel-harmony")
    monkeypatch.setenv("CONTENT_DIR", str(content.root))
    app = create_app()

    with TestClient(app):
        assert len(app.state.catalog.topics) == 1
