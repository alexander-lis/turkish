"""Команды для работы со справочником без запуска сервера."""

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from turkish_grammar.api.app import create_app
from turkish_grammar.content.errors import InvalidContentError, format_issues
from turkish_grammar.content.loader import KNOWN_WORDS_FILE, load_catalog, load_known_words
from turkish_grammar.content.model import Catalog
from turkish_grammar.content.summary import format_summary, summarize
from turkish_grammar.settings import Settings
from turkish_grammar.wordforms.check import check_word_forms


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="turkish-grammar",
        description="Команды турецкого грамматического справочника.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    check = commands.add_parser(
        "check-content", help="проверить контент и напечатать все найденные ошибки"
    )
    _add_content_dir(check)
    check.set_defaults(run=_check_content)

    words = commands.add_parser(
        "check-words",
        help="проверить морфологическим анализатором, что турецкие слова контента существуют",
    )
    _add_content_dir(words)
    words.set_defaults(run=_check_words)

    summary = commands.add_parser(
        "summarize-content",
        help="показать, сколько тем написано на каждом уровне и сколько у них примеров",
    )
    _add_content_dir(summary)
    summary.set_defaults(run=_summarize_content)

    export = commands.add_parser(
        "export-openapi", help="выгрузить описание API в формате OpenAPI без запуска сервера"
    )
    export.add_argument("--output", type=Path, help="файл для записи; по умолчанию — вывод")
    export.set_defaults(run=_export_openapi)

    arguments = parser.parse_args(argv)
    exit_code: int = arguments.run(arguments)
    return exit_code


def _add_content_dir(command: argparse.ArgumentParser) -> None:
    command.add_argument(
        "--content-dir",
        type=Path,
        help="каталог контента; по умолчанию берётся из CONTENT_DIR или content/ в корне",
    )


def _check_content(arguments: argparse.Namespace) -> int:
    content_dir = _content_dir(arguments)
    catalog = _load_or_report(content_dir)
    if catalog is None:
        return 1
    stubs = sum(topic.is_stub for topic in catalog.topics)
    print(f"Контент в порядке: тем {len(catalog.topics)}, из них заглушек {stubs}.")
    return 0


def _check_words(arguments: argparse.Namespace) -> int:
    content_dir = _content_dir(arguments)
    catalog = _load_or_report(content_dir)
    if catalog is None:
        return 1
    # Анализатор — зависимость разработки: серверу и остальным командам он не нужен.
    from turkish_grammar.wordforms.analyzer import is_recognized

    known_words, list_issues = load_known_words(content_dir)
    report = check_word_forms(catalog, known_words, is_recognized)
    issues = [*list_issues, *report.issues]
    if issues:
        heading = f"Проверка словоформ не пройдена, ошибок: {len(issues)}"
        print(format_issues(heading, issues, content_dir), file=sys.stderr)
        print(
            "Верное слово, которого анализатор не знает, вносится в "
            f"{content_dir / KNOWN_WORDS_FILE} вместе с причиной.",
            file=sys.stderr,
        )
        return 1
    print(
        f"Словоформы в порядке: турецких слов {report.words}, разных {report.distinct_words}, "
        f"в списке известных {len(known_words)}."
    )
    return 0


def _summarize_content(arguments: argparse.Namespace) -> int:
    catalog = _load_or_report(_content_dir(arguments))
    if catalog is None:
        return 1
    print(format_summary(summarize(catalog)))
    return 0


def _export_openapi(arguments: argparse.Namespace) -> int:
    # Контент для этого не нужен: приложение читает его только при старте сервера.
    document = json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n"
    if arguments.output is None:
        sys.stdout.write(document)
    else:
        arguments.output.write_text(document, encoding="utf-8")
    return 0


def _content_dir(arguments: argparse.Namespace) -> Path:
    return _shown_from_here(arguments.content_dir or Settings().content_dir)


def _load_or_report(content_dir: Path) -> Catalog | None:
    """Загрузить контент; если он не проходит проверку целостности, напечатать её отчёт."""
    try:
        return load_catalog(content_dir)
    except InvalidContentError as error:
        print(error.report(content_dir), file=sys.stderr)
        return None


def _shown_from_here(path: Path) -> Path:
    """Путь относительно текущего каталога: такие пути в отчёте короче и открываются по клику."""
    try:
        return path.resolve().relative_to(Path.cwd())
    except ValueError:
        return path
