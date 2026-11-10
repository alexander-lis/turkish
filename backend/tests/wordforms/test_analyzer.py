"""Адаптер анализатора: тесты с настоящим zeyrek.

Здесь же требование «Результат не зависит от порядка слов».
"""

import pytest

from turkish_grammar.wordforms.analyzer import is_recognized


@pytest.mark.parametrize("word", ["kitaplarda", "İstanbul'da", "saatler"])
def test_correct_form_is_recognized(word: str) -> None:
    assert is_recognized(word)


@pytest.mark.parametrize("word", ["kitaplerde", "sokakda"])
def test_broken_form_is_rejected(word: str) -> None:
    assert not is_recognized(word)


def test_answer_does_not_depend_on_words_checked_before() -> None:
    # Без изоляции zeyrek перестаёт признавать olarak после olmak и geliyorum после gelecek.
    assert is_recognized("olmak")
    assert is_recognized("olarak")
    assert is_recognized("gelecek")
    assert is_recognized("geliyorum")
