from collections.abc import Callable

import pytest

from tests.support import ContentBuilder, FakeAnalyzer
from turkish_grammar.cli import main


@pytest.fixture
def analyzer(monkeypatch: pytest.MonkeyPatch) -> FakeAnalyzer:
    """Подставной анализатор на месте настоящего: команда спрашивает о словах его."""
    fake = FakeAnalyzer()
    monkeypatch.setattr("turkish_grammar.wordforms.analyzer.is_recognized", fake)
    return fake


@pytest.fixture
def check_words(
    content: ContentBuilder, analyzer: FakeAnalyzer, capsys: pytest.CaptureFixture[str]
) -> Callable[[], tuple[int, str]]:
    """Запустить команду check-words; возвращает код завершения и отчёт об ошибках."""

    def run() -> tuple[int, str]:
        exit_code = main(["check-words", "--content-dir", str(content.root)])
        return exit_code, capsys.readouterr().err

    return run
