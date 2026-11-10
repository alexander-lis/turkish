"""Разбор по морфемам: две параллельные строки превращаются в слова и морфемы."""

from turkish_grammar.content.errors import ContentFormatError
from turkish_grammar.content.model import GlossedWord, GlossPart, Morpheme
from turkish_grammar.content.turkish import comparable

MORPHEME_SEPARATOR = "-"
GLOSS_PART_SEPARATOR = "."


class GlossError(ContentFormatError):
    """Разбор по морфемам записан неверно. Содержит все найденные расхождения."""

    def __init__(self, messages: list[str]) -> None:
        self.messages = tuple(messages)
        super().__init__("; ".join(messages))


def is_abbreviation(part: str) -> bool:
    """Обозначение — часть значения без строчных букв и хотя бы с одной заглавной: МН, 1ЕД."""
    return any(ch.isupper() for ch in part) and not any(ch.islower() for ch in part)


def parse_gloss(morphemes: str, gloss: str) -> tuple[GlossedWord, ...]:
    """Собрать разбор из строк ``morphemes`` и ``gloss``.

    Слова разделены пробелами, морфемы — дефисами; части составного значения — точками.
    """
    form_words = morphemes.split()
    gloss_words = gloss.split()
    if len(form_words) != len(gloss_words):
        raise GlossError(
            [f"в `morphemes` слов: {len(form_words)}, а в `gloss`: {len(gloss_words)}"]
        )

    problems: list[str] = []
    words: list[GlossedWord] = []
    for number, (form_word, gloss_word) in enumerate(zip(form_words, gloss_words, strict=True), 1):
        where = f"слово {number} «{form_word}»"
        forms = form_word.split(MORPHEME_SEPARATOR)
        glosses = gloss_word.split(MORPHEME_SEPARATOR)
        if not all(forms):
            problems.append(f"{where}: пустая морфема — лишний дефис в `morphemes`")
            continue
        if len(forms) != len(glosses):
            problems.append(
                f"{where}: морфем {len(forms)}, а значений в «{gloss_word}» {len(glosses)}"
            )
            continue
        parts_by_morpheme = [value.split(GLOSS_PART_SEPARATOR) for value in glosses]
        if not all(all(parts) for parts in parts_by_morpheme):
            problems.append(
                f"{where}: пустое значение в «{gloss_word}» — лишний дефис или точка в `gloss`"
            )
            continue
        words.append(
            GlossedWord(
                morphemes=tuple(
                    Morpheme(
                        form=form,
                        parts=tuple(
                            GlossPart(text=part, is_abbreviation=is_abbreviation(part))
                            for part in parts
                        ),
                    )
                    for form, parts in zip(forms, parts_by_morpheme, strict=True)
                )
            )
        )

    if problems:
        raise GlossError(problems)
    return tuple(words)


def check_gloss_matches_text(morphemes: str, text: str) -> None:
    """Убедиться, что ``morphemes`` разбирает весь текст примера в записанном виде."""
    expected = comparable(text)
    actual = comparable(morphemes)
    if actual != expected:
        raise ContentFormatError(
            f"разбор не совпадает с текстом примера: в `morphemes` «{actual}», в `tr` «{expected}»"
        )
