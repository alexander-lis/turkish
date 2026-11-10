"""Требования о разборе по морфемам, обозначениях и вводном тексте к ним."""

from tests.support import ContentBuilder, has_issue

ARTICLE = "## Формула\n\nОснова + -DA.\n"
EXAMPLES_FILE = "topics/locative-da/examples.yaml"


def example(tr: str, morphemes: str | None = None, gloss: str | None = None) -> str:
    lines = [f"- tr: {tr}", "  ru: Перевод."]
    if morphemes is not None:
        lines.append(f"  morphemes: {morphemes}")
    if gloss is not None:
        lines.append(f"  gloss: {gloss}")
    return "\n".join(lines) + "\n"


def test_consistent_gloss_is_loaded_as_words_and_morphemes(content: ContentBuilder) -> None:
    examples = example("Evlerimde.", "ev-ler-im-de", "дом-МН-1ЕД.ПРИТ-МЕСТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (loaded,) = content.load().topic("locative-da").examples

    assert loaded.gloss is not None
    (word,) = loaded.gloss
    assert [morpheme.form for morpheme in word.morphemes] == ["ev", "ler", "im", "de"]
    assert [morpheme.gloss for morpheme in word.morphemes] == ["дом", "МН", "1ЕД.ПРИТ", "МЕСТ"]


def test_different_morpheme_count_is_reported_with_file_number_and_word(
    content: ContentBuilder,
) -> None:
    examples = example("Evlerimde.", "ev-ler-im-de", "дом-МН-МЕСТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "слово 1", "ev-ler-im-de")


def test_different_word_count_is_reported(content: ContentBuilder) -> None:
    examples = example("Kitap masada.", "kitap masa-da", "книга")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "слов: 2", "`gloss`: 1")


def test_only_one_gloss_line_is_reported(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples=example("Evde.", morphemes="ev-de"))

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "`morphemes`", "`gloss`", "вместе")


def test_gloss_that_differs_from_text_is_reported(content: ContentBuilder) -> None:
    examples = example("Evlerimde.", "ev-ler-in-de", "дом-МН-1ЕД.ПРИТ-МЕСТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "не совпадает с текстом примера")


def test_gloss_must_cover_the_whole_text(content: ContentBuilder) -> None:
    examples = example("Kitap masada.", "masa-da", "стол-МЕСТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "не совпадает с текстом примера")


def test_turkish_case_and_apostrophe_are_ignored_when_matching(content: ContentBuilder) -> None:
    examples = example("İstanbul'da ılık.", "istanbul-da ılık", "Стамбул-МЕСТ тёплый")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (loaded,) = content.load().topic("locative-da").examples

    assert loaded.gloss is not None
    assert len(loaded.gloss) == 2


def test_emphasis_marks_are_ignored_when_matching(content: ContentBuilder) -> None:
    examples = example("Ev*de*yim.", "ev-de-yim", "дом-МЕСТ-1ЕД")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    assert content.load().topic("locative-da").examples[0].gloss is not None


def test_dotless_capital_i_does_not_match_dotted_small_i(content: ContentBuilder) -> None:
    examples = example("Irmak.", "irmak", "река")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "не совпадает с текстом примера")


def test_unknown_abbreviation_is_reported_with_file_number_and_code(
    content: ContentBuilder,
) -> None:
    content.topic("locative-da", article=ARTICLE, examples=example("Evde.", "ev-de", "дом-ЛОК"))

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "«ЛОК»", "abbreviations.yaml")


def test_compound_gloss_is_checked_part_by_part(content: ContentBuilder) -> None:
    examples = example("Evim.", "ev-im", "дом-1ЕД.ПРИТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (loaded,) = content.load().topic("locative-da").examples

    assert loaded.gloss is not None
    parts = loaded.gloss[0].morphemes[1].parts
    assert [(part.text, part.is_abbreviation) for part in parts] == [("1ЕД", True), ("ПРИТ", True)]


def test_unknown_part_of_compound_gloss_is_reported(content: ContentBuilder) -> None:
    examples = example("Evim.", "ev-im", "дом-1ЕД.ПОСС")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "«ПОСС»")


def test_lexical_gloss_is_not_checked_against_the_list(content: ContentBuilder) -> None:
    examples = example("Çünkü evde.", "çünkü ev-de", "потому.что дом-МЕСТ")
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (loaded,) = content.load().topic("locative-da").examples

    assert loaded.gloss is not None
    lexical = loaded.gloss[0].morphemes[0].parts
    assert [(part.text, part.is_abbreviation) for part in lexical] == [
        ("потому", False),
        ("что", False),
    ]


def test_repeated_abbreviation_code_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.write(
        "abbreviations.yaml",
        "- code: МН\n  meaning: множественное число\n- code: МН\n  meaning: много\n",
    )

    issues = content.issues()

    assert has_issue(issues, "abbreviations.yaml", "«МН»", "больше одного раза")


def test_abbreviation_code_with_lowercase_letters_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.abbreviations({"Мн": "множественное число"})

    issues = content.issues()

    assert has_issue(issues, "abbreviations.yaml", "недопустимый код «Мн»")


def test_abbreviations_keep_file_order(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.abbreviations({"МН": "множественное число", "ВИН": "винительный падеж"})

    assert [abbreviation.code for abbreviation in content.load().abbreviations] == ["МН", "ВИН"]


def test_missing_notation_file_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.remove("notation.md")

    issues = content.issues()

    assert has_issue(issues, "notation.md", "файл не найден")


def test_notation_text_is_loaded(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.write("notation.md", "Заглавная буква в формуле — чередующийся звук.\n")

    assert content.load().notation_markdown == "Заглавная буква в формуле — чередующийся звук."


def test_empty_notation_file_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.write("notation.md", "\n")

    issues = content.issues()

    assert has_issue(issues, "notation.md", "файл пуст")


def test_link_to_missing_topic_in_notation_is_reported(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.write("notation.md", "См. [гармонию гласных](topic:vowel-harmoni).\n")

    issues = content.issues()

    assert has_issue(issues, "notation.md", "topic:vowel-harmoni", "такой темы нет")


def test_link_to_existing_topic_in_notation_is_accepted(content: ContentBuilder) -> None:
    content.topic("plural-lar")
    content.write("notation.md", "См. [множественное число](topic:plural-lar).\n")

    assert "topic:plural-lar" in content.load().notation_markdown
