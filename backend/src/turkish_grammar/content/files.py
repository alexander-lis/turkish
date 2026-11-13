"""Форма файлов контента: какие поля в них допустимы.

Лишние поля запрещены, чтобы опечатка в имени поля становилась ошибкой, а не пропадала молча.
"""

from typing import Annotated

from pydantic import BaseModel, ConfigDict, StringConstraints, ValidationError

from turkish_grammar.content.model import ExampleSource, Level

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class _FileEntry(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class TopicMeta(_FileEntry):
    """Метаданные темы в начале ``topic.md``."""

    title: NonEmptyStr
    section: NonEmptyStr
    level: Level
    prerequisites: list[NonEmptyStr]
    related: list[NonEmptyStr] = []
    members: list[NonEmptyStr] = []
    summary: NonEmptyStr


class ExampleEntry(_FileEntry):
    """Один пример в ``examples.yaml``."""

    tr: NonEmptyStr
    ru: NonEmptyStr
    morphemes: NonEmptyStr | None = None
    gloss: NonEmptyStr | None = None
    note: NonEmptyStr | None = None
    source: ExampleSource = ExampleSource.AUTHORED


class SectionEntry(_FileEntry):
    """Один раздел в ``sections.yaml``."""

    id: NonEmptyStr
    title: NonEmptyStr


class AbbreviationEntry(_FileEntry):
    """Одно обозначение в ``abbreviations.yaml``."""

    code: NonEmptyStr
    meaning: NonEmptyStr


class ContrastEntry(_FileEntry):
    """Одно различение в ``contrasts.yaml``.

    Сколько тем должно быть в списках, проверяет загрузчик: в сообщении об ошибке
    нужно назвать номер записи.
    """

    topics: list[NonEmptyStr]
    title: NonEmptyStr
    explained_in: list[NonEmptyStr]


class KnownWordEntry(_FileEntry):
    """Одна запись в ``known-words.yaml``.

    Причина обязательна, но её наличие проверяет загрузчик: в сообщении об ошибке
    нужно назвать слово.
    """

    word: NonEmptyStr
    reason: str | None = None


_MESSAGES_BY_TYPE = {
    "string_type": "должно быть строкой",
    "string_too_short": "не должно быть пустым",
    "list_type": "должно быть списком",
}


def describe_validation_error(error: ValidationError) -> list[str]:
    """Перевести ошибки Pydantic в сообщения для автора контента."""
    messages: list[str] = []
    for detail in error.errors():
        field = _field_name(detail["loc"])
        kind = detail["type"]
        if kind == "missing":
            messages.append(f"нет обязательного поля `{field}`")
        elif kind == "extra_forbidden":
            messages.append(f"неизвестное поле `{field}`")
        elif kind == "enum":
            allowed = str(detail.get("ctx", {}).get("expected", ""))
            allowed = allowed.replace(" or ", ", ").replace("'", "")
            messages.append(
                f"поле `{field}`: недопустимое значение «{detail['input']}»; "
                f"допустимые значения: {allowed}"
            )
        elif kind in _MESSAGES_BY_TYPE:
            messages.append(f"поле `{field}` {_MESSAGES_BY_TYPE[kind]}")
        else:
            messages.append(f"поле `{field}`: {detail['msg']}")
    return messages


def _field_name(location: tuple[int | str, ...]) -> str:
    name = ""
    for part in location:
        if isinstance(part, int):
            name += f"[{part + 1}]"
        else:
            name += f".{part}" if name else part
    return name
