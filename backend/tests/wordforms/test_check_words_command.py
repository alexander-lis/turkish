"""Требования «Проверка словоформ отдельной командой», «Список известных слов»
и «В списке известных слов нет лишнего».
"""

from collections.abc import Callable

from tests.support import ContentBuilder, FakeAnalyzer, report_names

CheckWords = Callable[[], tuple[int, str]]

ARTICLE = "## Формула\n\nОснова и аффикс.\n"


def _topic_with_example(content: ContentBuilder, topic_id: str, tr: str) -> None:
    content.topic(
        topic_id, title="Тема", article=ARTICLE, examples=f'- tr: "{tr}"\n  ru: Перевод.\n'
    )


# --- Проверка словоформ отдельной командой ---


def test_word_with_broken_vowel_harmony_is_reported_with_its_file(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "Kitaplerde resim var.")
    analyzer.reject("kitaplerde")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "topics/plural-lar/examples.yaml", "«Kitaplerde»")


def test_command_returns_zero_when_every_word_is_recognized(
    content: ContentBuilder, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "Kitaplarda resim var.")

    exit_code, errors = check_words()

    assert exit_code == 0
    assert errors == ""


def test_proper_noun_with_apostrophe_is_checked_as_one_word(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "locative-da", "İstanbul'*da* yaşıyorum.")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["İstanbul'da", "yaşıyorum"]


def test_typographic_apostrophe_is_passed_to_analyzer_as_plain_one(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "locative-da", "İstanbul’da")

    check_words()

    assert analyzer.asked == ["İstanbul'da"]


def test_unrecognized_words_in_different_files_are_all_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "kitapler")
    _topic_with_example(content, "locative-da", "sokakda")
    analyzer.reject("kitapler", "sokakda")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "topics/plural-lar/examples.yaml", "«kitapler»")
    assert report_names(errors, "topics/locative-da/examples.yaml", "«sokakda»")
    assert "ошибок: 2" in errors


def test_each_distinct_word_is_sent_to_analyzer_once(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "Kitap, kitap, KİTAP.")
    _topic_with_example(content, "locative-da", "kitap")

    check_words()

    assert analyzer.asked == ["Kitap"]


def test_content_failing_integrity_check_is_reported_instead(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    content.topic("plural-lar", level="C1")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "topics/plural-lar/topic.md", "`level`")
    assert analyzer.asked == []


# --- Список известных слов ---


def test_known_word_is_not_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "converb-maksizin", "Durmaksızın çalışıyor.")
    content.write(
        "known-words.yaml", "- word: durmaksızın\n  reason: Редкое деепричастие на -mAksIzIn.\n"
    )
    analyzer.reject("durmaksızın")

    exit_code, errors = check_words()

    assert exit_code == 0
    assert errors == ""


def test_known_words_are_compared_in_turkish_lower_case(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "suffix-li", "Iğdırlı")
    content.write("known-words.yaml", "- word: ığdırlı\n  reason: Житель города Ыгдыр.\n")
    analyzer.reject("ığdırlı")

    exit_code, _ = check_words()

    assert exit_code == 0


def test_command_works_without_known_words_file(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "kitapler")
    analyzer.reject("kitapler")
    assert not (content.root / "known-words.yaml").exists()

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "topics/plural-lar/examples.yaml", "«kitapler»")


# --- В списке известных слов нет лишнего ---


def test_known_word_without_reason_is_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "converb-maksizin", "durmaksızın")
    content.write("known-words.yaml", "- word: durmaksızın\n")
    analyzer.reject("durmaksızın")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "known-words.yaml", "«durmaksızın»", "причина")


def test_known_word_recognized_by_analyzer_is_reported_as_unneeded(
    content: ContentBuilder, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "kitaplar")
    content.write("known-words.yaml", "- word: kitaplar\n  reason: На всякий случай.\n")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "known-words.yaml", "«kitaplar»", "лишняя запись")


def test_known_word_absent_from_content_is_reported_as_unneeded(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "kitaplar")
    content.write("known-words.yaml", "- word: durmaksızın\n  reason: Редкое деепричастие.\n")
    analyzer.reject("durmaksızın")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "known-words.yaml", "«durmaksızın»", "лишняя запись")


def test_malformed_known_words_file_is_reported(
    content: ContentBuilder, check_words: CheckWords
) -> None:
    _topic_with_example(content, "plural-lar", "kitaplar")
    content.write("known-words.yaml", "- word: kitaplar\n  why: Опечатка в имени поля.\n")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "known-words.yaml", "запись 1", "`why`")
