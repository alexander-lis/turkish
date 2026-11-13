"""Какие слова стоят в контенте: турецкие слова для анализатора и слова со смешанными алфавитами."""

import re
import unicodedata
from collections.abc import Iterable, Iterator
from dataclasses import dataclass
from functools import cache

from markdown_it.token import Token

from turkish_grammar.content.article import MARKDOWN
from turkish_grammar.content.errors import ContentIssue
from turkish_grammar.content.loader import (
    CONTRASTS_FILE,
    EXAMPLES_FILE,
    NOTATION_FILE,
    TOPIC_FILE,
    TOPICS_DIR,
)
from turkish_grammar.content.model import ARTICLE_TEMPLATE, Catalog

# Запись между пробелами и знаками препинания. Дефис, апостроф, скобки и косая черта в неё
# входят: по ним слово, разбитое на морфемы, отличается от формулы аффикса.
_CHUNK = re.compile(r"(?:[^\W_]|['’()/-])+")
_WEB_ADDRESS = re.compile(r"https?://\S+")
_BLOCK_HEADINGS = dict(ARTICLE_TEMPLATE)


@dataclass(frozen=True)
class FoundWord:
    """Турецкое слово контента: в каком файле и в каком его месте оно стоит."""

    path: str
    where: str
    word: str


@dataclass(frozen=True)
class FoundWords:
    turkish: tuple[FoundWord, ...]
    script_issues: tuple[ContentIssue, ...]


def find_words(catalog: Catalog) -> FoundWords:
    """Собрать турецкие слова всего контента и ошибки смешения алфавитов."""
    found = _Collector()
    for topic in catalog.topics:
        topic_file = f"{TOPICS_DIR}/{topic.id}/{TOPIC_FILE}"
        found.add(topic_file, "название", _inline_markdown_text(topic.title))
        found.add(topic_file, "суть", _inline_markdown_text(topic.summary))
        for block in topic.blocks:
            where = f"блок «{_BLOCK_HEADINGS[block.kind]}»"
            found.add(topic_file, where, _markdown_text(block.markdown))
        examples_file = f"{TOPICS_DIR}/{topic.id}/{EXAMPLES_FILE}"
        for number, example in enumerate(topic.examples, 1):
            found.add(examples_file, f"пример {number}", [example.tr.text], turkish_text=True)
    for number, contrast in enumerate(catalog.contrasts, 1):
        found.add(CONTRASTS_FILE, f"запись {number}", _inline_markdown_text(contrast.title))
    found.add(NOTATION_FILE, "", _markdown_text(catalog.notation_markdown))
    return FoundWords(turkish=tuple(found.turkish), script_issues=tuple(found.script_issues))


class _Collector:
    def __init__(self) -> None:
        self.turkish: list[FoundWord] = []
        self.script_issues: list[ContentIssue] = []

    def add(
        self, path: str, where: str, texts: Iterable[str], *, turkish_text: bool = False
    ) -> None:
        prefix = f"{where}: " if where else ""
        for text in texts:
            for chunk in _chunks(text):
                problem = _script_problem(chunk, turkish_text=turkish_text)
                if problem is not None:
                    # Смешение алфавитов — ошибка сама по себе: анализатор о таком слове
                    # не спрашивают, и список известных слов её не снимает.
                    self.script_issues.append(ContentIssue(path=path, message=prefix + problem))
                    continue
                word = _turkish_word(chunk)
                if word is not None:
                    self.turkish.append(FoundWord(path=path, where=where, word=word))


# --- Текст без разметки ---


def _markdown_text(markdown: str) -> Iterator[str]:
    """Текст абзацев, заголовков и ячеек таблиц — каждый отдельной строкой."""
    for token in MARKDOWN.parse(markdown):
        if token.type == "inline":
            yield _joined_text(token.children or ())
        elif token.type in ("fence", "code_block", "html_block"):
            yield token.content


def _inline_markdown_text(text: str) -> Iterator[str]:
    for token in MARKDOWN.parseInline(text):
        yield _joined_text(token.children or ())


def _joined_text(children: Iterable[Token]) -> str:
    """Склеить текст соседних узлов: ``kitap**lar**`` — одно слово ``kitaplar``.

    Зачёркнутый текст пропускается: так в статье помечают неверную форму.
    Адрес ссылки — атрибут узла, а не текст, поэтому сюда он не попадает.
    """
    parts: list[str] = []
    struck = 0
    for child in children:
        if child.type == "s_open":
            struck += 1
        elif child.type == "s_close":
            struck -= 1
            parts.append(" ")
        elif struck:
            continue
        elif child.type in ("softbreak", "hardbreak"):
            parts.append(" ")
        elif child.type in ("text", "code_inline", "html_inline"):
            parts.append(child.content)
    return "".join(parts)


# --- Записи и слова ---


def _chunks(text: str) -> Iterator[str]:
    # В NFC буква с диакритикой — один знак; иначе знак точки над i разрезал бы слово.
    text = unicodedata.normalize("NFC", text)
    for match in _CHUNK.finditer(_WEB_ADDRESS.sub(" ", text)):
        chunk = _trim(match.group())
        if chunk:
            yield chunk


def _trim(chunk: str) -> str:
    """Убрать с краёв апострофы и скобки, которые к записи не относятся.

    ``(kitap`` и ``(kitap)`` — слово в скобках, а в ``-(y)I`` скобки — часть формулы.
    """
    previous = None
    while chunk != previous:
        previous = chunk
        chunk = chunk.strip("'’")
        if _is_wrapped_in_brackets(chunk):
            chunk = chunk[1:-1]
        if chunk.startswith("(") and chunk.count("(") > chunk.count(")"):
            chunk = chunk[1:]
        if chunk.endswith(")") and chunk.count(")") > chunk.count("("):
            chunk = chunk[:-1]
    return chunk


def _is_wrapped_in_brackets(chunk: str) -> bool:
    """Открывающая скобка в начале закрывается последним знаком записи."""
    if not (chunk.startswith("(") and chunk.endswith(")")):
        return False
    depth = 0
    for index, ch in enumerate(chunk):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return index == len(chunk) - 1
    return False


def _script_problem(chunk: str, *, turkish_text: bool) -> str | None:
    latin = [ch for ch in chunk if _is_latin(ch)]
    cyrillic = [ch for ch in chunk if _is_cyrillic(ch)]
    if latin and cyrillic:
        # Чужие буквы на глаз не отличить, поэтому отчёт их называет.
        if turkish_text or len(cyrillic) <= len(latin):
            script, foreign = "кириллические", cyrillic
        else:
            script, foreign = "латинские", latin
        letters = ", ".join(f"«{ch}»" for ch in dict.fromkeys(foreign))
        return f"слово «{chunk}»: смешение алфавитов — {script} буквы {letters}"
    if cyrillic and turkish_text:
        return f"слово «{chunk}»: кириллица в турецком тексте"
    return None


def _turkish_word(chunk: str) -> str | None:
    """Слово для анализатора или ``None``, если запись как слово не проверяется."""
    if not any(_is_latin(ch) for ch in chunk):
        return None
    # Число с аффиксом (2020'de) анализатор не разбирает.
    if _is_affix_formula(chunk) or any(ch.isdigit() for ch in chunk):
        return None
    # Слово, разбитое на морфемы, проверяется слитно: okul-lar-ımız-da — это okullarımızda.
    word = chunk.replace("-", "").replace("’", "'")
    if sum(ch.isalpha() for ch in word) < 2:
        return None
    return word


def _is_affix_formula(chunk: str) -> bool:
    """Формула аффикса: -lAr, -(y)I, mI.

    Она начинается с дефиса либо содержит скобку, косую черту или заглавную букву после строчной.
    """
    if chunk.startswith("-") or any(ch in "()/" for ch in chunk):
        return True
    seen_lowercase = False
    for ch in chunk:
        if ch.isupper() and seen_lowercase:
            return True
        seen_lowercase = seen_lowercase or ch.islower()
    return False


@cache
def _is_latin(ch: str) -> bool:
    return ch.isalpha() and "LATIN" in unicodedata.name(ch, "")


@cache
def _is_cyrillic(ch: str) -> bool:
    return ch.isalpha() and "CYRILLIC" in unicodedata.name(ch, "")
