"""Требования о блоках статьи, заглушке, ссылках на темы в тексте и тексте без разметки."""

import unicodedata

from tests.support import ContentBuilder, has_issue
from turkish_grammar.content.article import plain_lines
from turkish_grammar.content.model import BlockKind

EXAMPLES = "- tr: Evdeyim.\n  ru: Я дома.\n"


def test_blocks_in_template_order_with_a_gap_are_loaded(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\nОснова + **-DA**.\n\n## Подводные камни\n\nНе путать с частицей.\n",
        examples=EXAMPLES,
    )

    blocks = content.load().topic("locative-da").blocks

    assert [block.kind for block in blocks] == [BlockKind.FORMULA, BlockKind.PITFALLS]
    assert blocks[0].markdown == "Основа + **-DA**."
    assert blocks[1].markdown == "Не путать с частицей."


def test_blocks_out_of_order_are_reported_with_expected_order(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формы\n\nТаблица.\n\n## Формула\n\nОснова + -DA.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(
        issues,
        "topics/locative-da/topic.md",
        "порядок блоков",
        "«Формула», «Формы», «Подводные камни», «Сравнение с русским»",
    )


def test_unknown_block_is_reported_with_its_heading(content: ContentBuilder) -> None:
    content.topic("locative-da", article="## Заметки\n\nТекст.\n", examples=EXAMPLES)

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "неизвестный блок", "Заметки")


def test_repeated_block_is_reported(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\nРаз.\n\n## Формула\n\nДва.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "«Формула»", "повторяется")


def test_text_outside_blocks_is_reported(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="Вступление без блока.\n\n## Формула\n\nОснова + -DA.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "текст вне блоков")


def test_block_without_text_is_reported_with_its_heading(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\n## Формы\n\nТаблица.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "блок «Формула» пуст")


def test_first_level_heading_is_reported(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\n# Большой заголовок\n\nТекст.\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "заголовок первого уровня")


def test_heading_inside_code_block_is_not_a_block_heading(content: ContentBuilder) -> None:
    article = "## Формула\n\n```\n## Заметки\n```\n\nТекст после кода.\n"
    content.topic("locative-da", article=article, examples=EXAMPLES)

    blocks = content.load().topic("locative-da").blocks

    assert [block.kind for block in blocks] == [BlockKind.FORMULA]
    assert "## Заметки" in blocks[0].markdown


def test_subheadings_stay_inside_their_block(content: ContentBuilder) -> None:
    article = "## Формы\n\n### После гласной\n\nТекст.\n"
    content.topic("locative-da", article=article, examples=EXAMPLES)

    blocks = content.load().topic("locative-da").blocks

    assert blocks[0].markdown == "### После гласной\n\nТекст."


def test_topic_with_metadata_only_is_a_stub_and_needs_no_examples(content: ContentBuilder) -> None:
    content.topic("plural-lar")

    topic = content.load().topic("plural-lar")

    assert topic.is_stub
    assert topic.blocks == ()
    assert topic.examples == ()


def test_written_topic_is_not_a_stub(content: ContentBuilder) -> None:
    content.topic("locative-da", article="## Формула\n\nОснова + -DA.\n", examples=EXAMPLES)

    assert not content.load().topic("locative-da").is_stub


def test_link_to_existing_topic_is_accepted(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic(
        "locative-da",
        article="## Формула\n\nСм. [гармонию гласных](topic:vowel-harmony).\n",
        examples=EXAMPLES,
    )

    assert not content.load().topic("locative-da").is_stub


def test_link_to_missing_topic_is_reported_with_topic_and_address(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\nСм. [гармонию гласных](topic:vowel-harmoni).\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "topic:vowel-harmoni", "такой темы нет")


def test_link_to_missing_topic_inside_table_is_reported(content: ContentBuilder) -> None:
    article = "## Формы\n\n| Аффикс | Тема |\n| --- | --- |\n| -da | [тема](topic:nowhere) |\n"
    content.topic("locative-da", article=article, examples=EXAMPLES)

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "topic:nowhere")


def test_link_with_unsupported_address_is_reported(content: ContentBuilder) -> None:
    content.topic("vowel-harmony")
    content.topic(
        "locative-da",
        article="## Формула\n\nСм. [гармонию гласных](vowel-harmony).\n",
        examples=EXAMPLES,
    )

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/topic.md", "«vowel-harmony»", "topic:<id>")


def test_external_link_is_accepted(content: ContentBuilder) -> None:
    content.topic(
        "locative-da",
        article="## Формула\n\nСм. [словарь](https://sozluk.gov.tr).\n",
        examples=EXAMPLES,
    )

    assert not content.load().topic("locative-da").is_stub


# --- Текст статьи в поисковом индексе без разметки ---


def test_emphasis_inside_a_word_does_not_split_it() -> None:
    assert plain_lines("Множественное число: kitap**lar**, *ev*ler.") == (
        "Множественное число: kitaplar, evler.",
    )


def test_link_keeps_its_text_and_loses_its_address() -> None:
    lines = plain_lines("Гласную выбирает [гармония гласных](topic:vowel-harmony).")

    assert lines == ("Гласную выбирает гармония гласных.",)


def test_struck_text_stays_without_strikethrough_marks() -> None:
    assert plain_lines("Пишут *kitapta*, а не ~~kitap ta~~.") == ("Пишут kitapta, а не kitap ta.",)


def test_table_gives_a_line_per_row_without_the_delimiter_row() -> None:
    table = "| После | Аффикс |\n| ----- | ------ |\n| a, ı  | **-da** |\n| e, i  | -de    |\n"

    assert plain_lines(table) == ("После Аффикс", "a, ı -da", "e, i -de")


def test_subheading_and_paragraph_are_separate_lines() -> None:
    lines = plain_lines("### Частица не оглушается\n\nЧастица *da* пишется\nотдельно.\n")

    assert lines == ("Частица не оглушается", "Частица da пишется отдельно.")


def test_every_list_item_is_a_line() -> None:
    lines = plain_lines("После глухого:\n\n- `-ta` после *a*;\n- `-te` после *e*.\n")

    assert lines == ("После глухого:", "-ta после a;", "-te после e.")


def test_code_block_gives_a_line_per_its_line() -> None:
    assert plain_lines("```\nev-de\n\nokul-da\n```\n") == ("ev-de", "okul-da")


def test_lines_are_normalized_to_nfc() -> None:
    decomposed = unicodedata.normalize("NFD", "çünkü ещё")

    assert plain_lines(decomposed) == ("çünkü ещё",)
    assert plain_lines(decomposed) != (decomposed,)
