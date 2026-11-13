"""Какие слова контента проверяются: требования «Что охватывает проверка словоформ»,
«Турецкое слово в русском тексте», «Что не проверяется как слово»
и «Смешение алфавитов в одном слове».
"""

from collections.abc import Callable

from tests.support import ContentBuilder, FakeAnalyzer, report_names

CheckWords = Callable[[], tuple[int, str]]

TOPIC_FILE = "topics/locative-da/topic.md"
EXAMPLES_FILE = "topics/locative-da/examples.yaml"
EXAMPLES = "- tr: Evde.\n  ru: Дома.\n"


def _written_topic(content: ContentBuilder, article: str, *, examples: str = EXAMPLES) -> None:
    """Тема, в которой латиницей набраны только слова статьи и примеров."""
    content.topic(
        "locative-da",
        title="Местный падеж",
        article=f"## Формула\n\n{article}\n",
        examples=examples,
    )


# --- Что охватывает проверка словоформ ---


def test_word_in_summary_of_stub_is_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    content.topic("present-yor", summary="Настоящее время: geliyorim — «я иду».")
    analyzer.reject("geliyorim")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "topics/present-yor/topic.md", "«geliyorim»")


def test_word_in_table_of_forms_is_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    table = "| После глухого |\n| --- |\n| sokakda |\n"
    content.topic(
        "locative-da", article=f"## Формы\n\n{table}", examples="- tr: Evde.\n  ru: Дома.\n"
    )
    analyzer.reject("sokakda")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, TOPIC_FILE, "«sokakda»", "блок «Формы»")


def test_title_examples_and_notation_are_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    content.topic(
        "locative-da",
        title="Падеж в слове evdde",
        article="## Формула\n\nОснова и аффикс.\n",
        examples="- tr: Kitap *masadda*.\n  ru: Книга на столе.\n",
    )
    content.write("notation.md", "Разбор слова evlerimdde.\n")
    analyzer.reject("evdde", "masadda", "evlerimdde")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, TOPIC_FILE, "«evdde»", "название")
    assert report_names(errors, EXAMPLES_FILE, "«masadda»", "пример 1")
    assert report_names(errors, "notation.md", "«evlerimdde»")


def test_word_in_contrast_title_is_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    for topic_id in ("locative-da", "particle-da", "possessive-suffixes"):
        content.topic(topic_id, title="Тема без латиницы")
    content.contrast(
        ["locative-da", "particle-da"],
        title="Аффикс -DA и частица dA",
        explained_in=["locative-da"],
    )
    content.contrast(
        ["locative-da", "possessive-suffixes"],
        title="evlarimde и ev-im-de",
        explained_in=["possessive-suffixes"],
    )
    analyzer.reject("evlarimde")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, "contrasts.yaml", "«evlarimde»", "запись 2")
    assert analyzer.asked == ["evlarimde", "evimde"]


# --- Турецкое слово в русском тексте ---


def test_word_split_into_morphemes_is_checked_as_one_word(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "Каждый аффикс смотрит на гласную перед собой: okul-lar-ımız-da.")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["okullarımızda", "Evde"]


def test_word_with_emphasized_part_is_checked_as_one_word(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "Множественное число: kitap**lar**, а в курсиве — *ev**ler***.")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["kitaplar", "evler", "Evde"]


def test_wrong_word_inside_russian_sentence_is_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "Слово evlarimde значит «в моих домах».")
    analyzer.reject("evlarimde")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, TOPIC_FILE, "«evlarimde»")


def test_russian_words_and_numbers_are_not_sent_to_analyzer(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "В 2020 году (то есть давно) было 5 книг, или 2020'de.")

    check_words()

    assert analyzer.asked == ["Evde"]


def test_word_in_brackets_is_checked_without_them(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "После слов количества (çok) и вопроса (kaç kişi) аффикса нет.")

    check_words()

    assert analyzer.asked == ["çok", "kaç", "kişi", "Evde"]


# --- Что не проверяется как слово ---


def test_affix_formulas_are_not_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "Аффиксы -lAr, -da и **-(y)I**, частица mI, варианты -da / -de.")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["Evde"]


def test_single_letters_are_not_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "После глухих (p, ç, t, k) согласный оглушается, а не после a или I.")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["Evde"]


def test_struck_through_form_is_not_checked(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    _written_topic(content, "После глухого согласного не ~~sokakda~~, а sokakta.")
    analyzer.reject("sokakda")

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["sokakta", "Evde"]


def test_link_address_is_not_checked_but_link_text_is(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    content.topic("vowel-harmony", title="Гармония гласных")
    _written_topic(
        content,
        "См. [слово uyum](topic:vowel-harmony) и [словарь](https://sozluk.gov.tr/gts).",
    )

    exit_code, _ = check_words()

    assert exit_code == 0
    assert analyzer.asked == ["uyum", "Evde"]


# --- Смешение алфавитов в одном слове ---


def test_cyrillic_letter_inside_turkish_word_of_example_is_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    with_cyrillic_a = "kit\N{CYRILLIC SMALL LETTER A}p"
    _written_topic(content, "Основа и аффикс.", examples=f"- tr: {with_cyrillic_a}\n  ru: книга\n")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, EXAMPLES_FILE, f"«{with_cyrillic_a}»", "смешение алфавитов")
    assert analyzer.asked == []


def test_latin_letter_inside_russian_word_of_article_is_reported(
    content: ContentBuilder, analyzer: FakeAnalyzer, check_words: CheckWords
) -> None:
    with_latin_o = "д\N{LATIN SMALL LETTER O}м"
    _written_topic(content, f"Слово ev значит «{with_latin_o}».")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, TOPIC_FILE, f"«{with_latin_o}»", "смешение алфавитов", "латинские")
    assert analyzer.asked == ["ev", "Evde"]


def test_mixed_alphabets_are_reported_even_for_known_word(
    content: ContentBuilder, check_words: CheckWords
) -> None:
    with_cyrillic_a = "kit\N{CYRILLIC SMALL LETTER A}p"
    _written_topic(content, "Основа и аффикс.", examples=f"- tr: {with_cyrillic_a}\n  ru: книга\n")
    content.write("known-words.yaml", f"- word: {with_cyrillic_a}\n  reason: Редкое слово.\n")

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, EXAMPLES_FILE, f"«{with_cyrillic_a}»", "смешение алфавитов")


def test_word_typed_in_cyrillic_inside_turkish_text_is_reported(
    content: ContentBuilder, check_words: CheckWords
) -> None:
    cyrillic_o = "\N{CYRILLIC SMALL LETTER O}"
    examples = f"- tr: {cyrillic_o} evde\n  ru: он дома\n"
    _written_topic(content, "Основа и аффикс.", examples=examples)

    exit_code, errors = check_words()

    assert exit_code != 0
    assert report_names(errors, EXAMPLES_FILE, f"«{cyrillic_o}»", "кириллица")
