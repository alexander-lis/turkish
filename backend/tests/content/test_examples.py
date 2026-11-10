"""Требования о формате примера, его источнике, выделении и обязательности примеров."""

from tests.support import ContentBuilder, has_issue
from turkish_grammar.content.model import ExampleSource, TextSegment

ARTICLE = "## Формула\n\nОснова + -DA.\n"
EXAMPLES_FILE = "topics/locative-da/examples.yaml"


def test_example_without_translation_is_reported_with_file_and_number(
    content: ContentBuilder,
) -> None:
    examples = "- tr: Evdeyim.\n  ru: Я дома.\n- tr: Okuldayım.\n"
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 2", "нет обязательного поля", "`ru`")


def test_minimal_example_is_loaded(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples="- tr: Evdeyim.\n  ru: Я дома.\n")

    (example,) = content.load().topic("locative-da").examples

    assert example.tr.text == "Evdeyim."
    assert example.ru.text == "Я дома."
    assert example.note is None
    assert example.gloss is None


def test_unknown_example_field_is_reported(content: ContentBuilder) -> None:
    examples = "- tr: Evdeyim.\n  ru: Я дома.\n  comment: лишнее\n"
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "неизвестное поле", "`comment`")


def test_example_without_source_is_authored(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples="- tr: Evdeyim.\n  ru: Я дома.\n")

    (example,) = content.load().topic("locative-da").examples

    assert example.source is ExampleSource.AUTHORED


def test_generated_source_is_kept(content: ContentBuilder) -> None:
    examples = "- tr: Evdeyim.\n  ru: Я дома.\n  source: generated\n"
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (example,) = content.load().topic("locative-da").examples

    assert example.source is ExampleSource.GENERATED


def test_invalid_source_is_reported_with_allowed_values(content: ContentBuilder) -> None:
    examples = "- tr: Evdeyim.\n  ru: Я дома.\n  source: ai\n"
    content.topic("locative-da", article=ARTICLE, examples=examples)

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "`source`", "«ai»", "authored, generated")


def test_emphasized_fragment_is_separated_from_clean_text(content: ContentBuilder) -> None:
    examples = "- tr: Ev*de*yim.\n  ru: Я *до́ма*.\n"
    content.topic("locative-da", article=ARTICLE, examples=examples)

    (example,) = content.load().topic("locative-da").examples

    assert example.tr.text == "Evdeyim."
    assert example.tr.segments == (
        TextSegment(text="Ev", emphasized=False),
        TextSegment(text="de", emphasized=True),
        TextSegment(text="yim.", emphasized=False),
    )
    assert example.ru.text == "Я до́ма."


def test_unpaired_asterisk_is_reported_with_file_and_number(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples="- tr: Ev*deyim.\n  ru: Я дома.\n")

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "`tr`", "без пары")


def test_empty_emphasis_is_reported_with_file_and_number(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples="- tr: Ev**deyim.\n  ru: Я дома.\n")

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "`tr`", "пустое выделение")


def test_written_topic_without_examples_file_is_reported(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE)

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da", "нет ни одного примера")


def test_written_topic_with_empty_examples_file_is_reported(content: ContentBuilder) -> None:
    content.topic("locative-da", article=ARTICLE, examples="")

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da", "нет ни одного примера")


def test_broken_examples_file_is_not_also_reported_as_missing_examples(
    content: ContentBuilder,
) -> None:
    content.topic("locative-da", article=ARTICLE, examples="- tr: Evdeyim.\n")

    issues = content.issues()

    assert has_issue(issues, EXAMPLES_FILE, "пример 1", "`ru`")
    assert not has_issue(issues, "topics/locative-da", "нет ни одного примера")
