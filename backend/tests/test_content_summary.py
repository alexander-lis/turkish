"""Требование «Сводка наполнения отдельной командой»."""

import pytest

from tests.support import ContentBuilder
from turkish_grammar.cli import main

ARTICLE = "## Формула\n\nОснова и аффикс.\n"
PLAIN_EXAMPLE = "- tr: Evde.\n  ru: Дома.\n"
GLOSSED_EXAMPLE = "- tr: Evde.\n  ru: Дома.\n  morphemes: ev-de\n  gloss: дом-МЕСТ\n"


def _examples(total: int, *, glossed: int = 0) -> str:
    return GLOSSED_EXAMPLE * glossed + PLAIN_EXAMPLE * (total - glossed)


def _summary(content: ContentBuilder, capsys: pytest.CaptureFixture[str]) -> str:
    assert main(["summarize-content", "--content-dir", str(content.root)]) == 0
    return capsys.readouterr().out


def _row(summary: str, name: str) -> list[str]:
    """Ячейки строки сводки после её первого столбца."""
    for line in summary.splitlines():
        cells = line.split()
        if cells and cells[0] == name:
            return cells[1:]
    raise AssertionError(f"в сводке нет строки «{name}»")


def test_level_row_counts_topics_written_topics_and_stubs(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    for number in range(76):
        if number < 3:
            content.topic(f"topic-{number}", article=ARTICLE, examples=_examples(1))
        else:
            content.topic(f"topic-{number}")

    summary = _summary(content, capsys)

    assert _row(summary, "A1") == ["76", "3", "73"]


def test_written_topic_row_shows_level_examples_and_glossed_examples(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("locative-da", article=ARTICLE, examples=_examples(9, glossed=5))

    summary = _summary(content, capsys)

    assert _row(summary, "locative-da") == ["A1", "9", "5"]


def test_stub_is_counted_in_its_level_and_has_no_row_of_its_own(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("locative-da", article=ARTICLE, examples=_examples(1))
    content.topic("passive-il", level="B1")

    summary = _summary(content, capsys)

    assert _row(summary, "B1") == ["1", "0", "1"]
    assert "passive-il" not in summary


def test_written_topics_follow_the_learning_path(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("vowel-harmony", article=ARTICLE, examples=_examples(1))
    content.topic("plural-lar", article=ARTICLE, examples=_examples(1))
    content.path(["plural-lar", "vowel-harmony"])

    summary = _summary(content, capsys)

    assert summary.index("plural-lar") < summary.index("vowel-harmony")


def test_invalid_content_is_reported_instead_of_summary(
    content: ContentBuilder, capsys: pytest.CaptureFixture[str]
) -> None:
    content.topic("plural-lar", level="C1")

    exit_code = main(["summarize-content", "--content-dir", str(content.root)])

    captured = capsys.readouterr()
    assert exit_code != 0
    assert "topics/plural-lar/topic.md: " in captured.err
    assert captured.out == ""
