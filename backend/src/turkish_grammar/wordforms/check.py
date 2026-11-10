"""Проверка словоформ: какие турецкие слова контента анализатор не признаёт."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass

from turkish_grammar.content.errors import ContentIssue
from turkish_grammar.content.loader import KNOWN_WORDS_FILE
from turkish_grammar.content.model import Catalog, KnownWord
from turkish_grammar.content.turkish import turkish_lower
from turkish_grammar.wordforms.extraction import find_words

# Анализатор: признаёт ли он слово словоформой турецкого языка.
Analyzer = Callable[[str], bool]


@dataclass(frozen=True)
class WordFormReport:
    issues: tuple[ContentIssue, ...]
    words: int
    distinct_words: int


def check_word_forms(
    catalog: Catalog, known_words: Sequence[KnownWord], recognizes: Analyzer
) -> WordFormReport:
    """Проверить каждое турецкое слово контента и сам список известных слов.

    Каждое разное слово анализатор получает один раз; регистр сравнивается по-турецки.
    """
    found = find_words(catalog)
    issues = list(found.script_issues)

    first_spelling: dict[str, str] = {}
    for occurrence in found.turkish:
        first_spelling.setdefault(_key(occurrence.word), occurrence.word)
    unrecognized = {key for key, word in first_spelling.items() if not recognizes(word)}
    known = {_key(entry.word) for entry in known_words}

    reported: set[tuple[str, str, str]] = set()
    for occurrence in found.turkish:
        key = _key(occurrence.word)
        place = (occurrence.path, occurrence.where, key)
        if key in unrecognized and key not in known and place not in reported:
            reported.add(place)
            prefix = f"{occurrence.where}: " if occurrence.where else ""
            issues.append(
                ContentIssue(
                    path=occurrence.path,
                    message=f"{prefix}слово «{occurrence.word}»: анализатор не признаёт "
                    "такую словоформу",
                )
            )

    for entry in known_words:
        key = _key(entry.word)
        if key not in first_spelling:
            reason = "такого слова в контенте нет"
        elif key not in unrecognized:
            reason = "анализатор признаёт это слово"
        else:
            continue
        issues.append(
            ContentIssue(
                path=KNOWN_WORDS_FILE, message=f"слово «{entry.word}»: лишняя запись — {reason}"
            )
        )

    return WordFormReport(
        issues=tuple(issues), words=len(found.turkish), distinct_words=len(first_spelling)
    )


def _key(word: str) -> str:
    return turkish_lower(word.replace("’", "'"))
