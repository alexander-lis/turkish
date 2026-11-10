"""Требование «Проверка контента отдельной командой»."""

import json
from pathlib import Path

import pytest

from tests.support import ContentBuilder
from turkish_grammar.cli import main


def test_check_content_returns_zero_for_valid_content(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("vowel-harmony")
    content.topic("plural-lar", prerequisites=["vowel-harmony"])

    exit_code = main(["check-content", "--content-dir", str(content.root)])

    assert exit_code == 0
    assert "тем 2, из них заглушек 2" in capsys.readouterr().out


def test_check_content_prints_all_errors_and_returns_nonzero(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("vowel-harmony", level="C1")
    content.topic("plural-lar", prerequisites=["no-such-topic"])

    exit_code = main(["check-content", "--content-dir", str(content.root)])

    errors = capsys.readouterr().err
    assert exit_code != 0
    assert "topics/vowel-harmony/topic.md: " in errors
    assert "topics/plural-lar/topic.md: " in errors


def test_check_content_reads_directory_from_environment(
    content: ContentBuilder, monkeypatch: pytest.MonkeyPatch
) -> None:
    content.topic("vowel-harmony", level="C1")
    monkeypatch.setenv("CONTENT_DIR", str(content.root))

    assert main(["check-content"]) != 0


def test_export_openapi_writes_contract_without_content(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setenv("CONTENT_DIR", str(tmp_path / "no-content-here"))
    output = tmp_path / "openapi.json"

    exit_code = main(["export-openapi", "--output", str(output)])

    document = json.loads(output.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert "/api/topics/{id}" in document["paths"]
