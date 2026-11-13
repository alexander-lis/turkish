"""Докстринг каждого модуля называет роль не длиннее трёх строк; у каждого модуля есть строка
в карте кода ARCHITECTURE.md. Подробности живут там и в спецификациях: копия в докстринге
с ними расходится.
"""

import ast
import re
from pathlib import Path

from turkish_grammar.settings import REPO_ROOT

SRC = REPO_ROOT / "backend" / "src" / "turkish_grammar"
ARCHITECTURE = REPO_ROOT / "ARCHITECTURE.md"
MAX_LINES = 3

# Строка карты кода: «| `пакет` | `модуль` | …»; пустая первая колонка — пакет строки выше.
CODE_MAP_ROW = re.compile(r"^\| (?:`(?P<package>[\w.]+)`)? ?\| `(?P<module>\w+)` \|")


def code_map_modules() -> set[str]:
    """Модули из таблицы «Карта кода» точечными именами от корня пакета: ``content.loader``."""
    text = ARCHITECTURE.read_text(encoding="utf-8")
    section = text.split("\n## Карта кода\n", 1)[1].split("\n## ", 1)[0]
    names: set[str] = set()
    package = ""
    for line in section.splitlines():
        row = CODE_MAP_ROW.match(line)
        if row:
            package = row["package"] or package
            names.add(f"{package}.{row['module']}".lstrip("."))
    return names


def source_modules() -> set[str]:
    """Модули, которым положена строка в карте кода: все, кроме пустых ``__init__.py``.

    Пустой — без функций и классов, только с докстрингом пакета.
    """
    names: set[str] = set()
    for path in SRC.rglob("*.py"):
        body = ast.parse(path.read_text(encoding="utf-8")).body
        definitions = (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)
        if path.name == "__init__.py" and not any(isinstance(n, definitions) for n in body):
            continue
        names.add(".".join(path.relative_to(SRC).with_suffix("").parts))
    return names


def _problems_with_docstrings(paths: list[Path]) -> list[str]:
    problems = []
    for path in paths:
        name = path.relative_to(SRC.parent)
        doc = ast.get_docstring(ast.parse(path.read_text(encoding="utf-8")))
        if not doc:
            problems.append(f"{name}: докстринга нет")
        elif (lines := len(doc.splitlines())) > MAX_LINES:
            problems.append(f"{name}: строк {lines}, предел {MAX_LINES}")
    return problems


def test_every_module_has_a_short_docstring() -> None:
    modules = sorted(SRC.rglob("*.py"))
    assert modules, f"модули не найдены в {SRC}"
    problems = _problems_with_docstrings(modules)
    assert not problems, "докстринги модулей:\n" + "\n".join(problems)


def test_code_map_has_a_row_for_every_module() -> None:
    listed, present = code_map_modules(), source_modules()
    assert listed, f"таблица «Карта кода» не разобрана в {ARCHITECTURE}"
    problems = [f"{name}: модуль есть, строки в карте нет" for name in sorted(present - listed)]
    problems += [f"{name}: строка в карте есть, модуля нет" for name in sorted(listed - present)]
    assert not problems, "карта кода ARCHITECTURE.md:\n" + "\n".join(problems)
