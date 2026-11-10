"""Команды для работы со справочником без запуска сервера."""

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from turkish_grammar.api.app import create_app
from turkish_grammar.content.errors import InvalidContentError
from turkish_grammar.content.loader import load_catalog
from turkish_grammar.settings import Settings


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="turkish-grammar",
        description="Команды турецкого грамматического справочника.",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    check = commands.add_parser(
        "check-content", help="проверить контент и напечатать все найденные ошибки"
    )
    check.add_argument(
        "--content-dir",
        type=Path,
        help="каталог контента; по умолчанию берётся из CONTENT_DIR или content/ в корне",
    )
    check.set_defaults(run=_check_content)

    export = commands.add_parser(
        "export-openapi", help="выгрузить описание API в формате OpenAPI без запуска сервера"
    )
    export.add_argument("--output", type=Path, help="файл для записи; по умолчанию — вывод")
    export.set_defaults(run=_export_openapi)

    arguments = parser.parse_args(argv)
    exit_code: int = arguments.run(arguments)
    return exit_code


def _check_content(arguments: argparse.Namespace) -> int:
    content_dir = _shown_from_here(arguments.content_dir or Settings().content_dir)
    try:
        catalog = load_catalog(content_dir)
    except InvalidContentError as error:
        print(error.report(content_dir), file=sys.stderr)
        return 1
    stubs = sum(topic.is_stub for topic in catalog.topics)
    print(f"Контент в порядке: тем {len(catalog.topics)}, из них заглушек {stubs}.")
    return 0


def _export_openapi(arguments: argparse.Namespace) -> int:
    # Контент для этого не нужен: приложение читает его только при старте сервера.
    document = json.dumps(create_app().openapi(), ensure_ascii=False, indent=2) + "\n"
    if arguments.output is None:
        sys.stdout.write(document)
    else:
        arguments.output.write_text(document, encoding="utf-8")
    return 0


def _shown_from_here(path: Path) -> Path:
    """Путь относительно текущего каталога: такие пути в отчёте короче и открываются по клику."""
    try:
        return path.resolve().relative_to(Path.cwd())
    except ValueError:
        return path
