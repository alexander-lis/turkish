"""Требование «Невалидный контент не показывается читателю»: отчёт содержит все ошибки."""

from tests.support import ContentBuilder, has_issue


def test_report_lists_errors_from_different_files(content: ContentBuilder) -> None:
    content.topic("plural-lar", level="C1")
    content.topic(
        "locative-da",
        article="## Заметки\n\nТекст.\n",
        examples="- tr: Evdeyim.\n  ru: Я дома.\n",
    )

    issues = content.issues()

    assert has_issue(issues, "topics/plural-lar/topic.md", "`level`", "C1")
    assert has_issue(issues, "topics/locative-da/topic.md", "неизвестный блок", "Заметки")


def test_report_text_names_file_and_reason_for_every_error(content: ContentBuilder) -> None:
    content.topic("plural-lar", level="C1")
    content.topic("locative-da", prerequisites=["no-such-topic"])

    report = content.load_error().report(content.root)

    assert f"{content.root}/topics/plural-lar/topic.md: " in report
    assert f"{content.root}/topics/locative-da/topic.md: " in report
    assert "ошибок: 2" in report


def test_errors_inside_one_file_are_all_reported(content: ContentBuilder) -> None:
    examples = "- tr: Ev*deyim.\n  ru: Я дома.\n- tr: Okulda.\n  source: ai\n  ru: В школе.\n"
    content.topic("locative-da", article="## Формула\n\nОснова + -DA.\n", examples=examples)

    issues = content.issues()

    assert has_issue(issues, "topics/locative-da/examples.yaml", "пример 1", "без пары")
    assert has_issue(issues, "topics/locative-da/examples.yaml", "пример 2", "`source`")
