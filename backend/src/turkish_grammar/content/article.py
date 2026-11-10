"""Разбор файла статьи: метаданные, блоки по шаблону и ссылки.

Текст разбирается через markdown-it-py, а не по строкам: заголовок внутри блока кода
не должен считаться заголовком блока статьи, а ссылки нужны вместе с адресами.
В HTML текст здесь не превращается — это делает интерфейс.
"""

from collections.abc import Iterator, Sequence
from dataclasses import dataclass

from markdown_it import MarkdownIt
from markdown_it.token import Token

from turkish_grammar.content.errors import ContentFormatError
from turkish_grammar.content.model import ARTICLE_TEMPLATE, ArticleBlock, BlockKind

FRONTMATTER_FENCE = "---"
TOPIC_LINK_SCHEME = "topic:"
EXTERNAL_LINK_SCHEMES = ("http://", "https://")

MARKDOWN = MarkdownIt("commonmark").enable(["table", "strikethrough"])
_KIND_BY_HEADING = {heading: kind for kind, heading in ARTICLE_TEMPLATE}
_TEMPLATE_POSITION = {kind: position for position, (kind, _) in enumerate(ARTICLE_TEMPLATE)}
_TEMPLATE_HEADINGS = ", ".join(f"«{heading}»" for _, heading in ARTICLE_TEMPLATE)


@dataclass(frozen=True)
class TopicLink:
    """Ссылка на тему в тексте: идентификатор и номер строки файла, где она стоит."""

    topic_id: str
    line: int


@dataclass(frozen=True)
class ParsedMarkdown:
    topic_links: tuple[TopicLink, ...]
    problems: tuple[str, ...]


@dataclass(frozen=True)
class ParsedArticle:
    blocks: tuple[ArticleBlock, ...]
    topic_links: tuple[TopicLink, ...]
    problems: tuple[str, ...]


def split_frontmatter(text: str) -> tuple[str, str, int]:
    """Отделить метаданные от текста статьи.

    Возвращает текст метаданных, текст статьи и номер строки файла, с которой статья начинается.
    """
    lines = text.splitlines()
    if not lines or lines[0].strip() != FRONTMATTER_FENCE:
        raise ContentFormatError("файл должен начинаться с метаданных между строками «---»")
    for index in range(1, len(lines)):
        if lines[index].strip() == FRONTMATTER_FENCE:
            metadata = "\n".join(lines[1:index])
            body = "\n".join(lines[index + 1 :])
            return metadata, body, index + 2
    raise ContentFormatError("метаданные в начале файла не закрыты строкой «---»")


def parse_markdown_links(text: str, *, first_line: int = 1) -> ParsedMarkdown:
    """Найти в тексте ссылки на темы и ссылки с адресами, которые справочник не поддерживает."""
    links, problems = _collect_links(MARKDOWN.parse(text), first_line)
    return ParsedMarkdown(topic_links=tuple(links), problems=tuple(problems))


def parse_article(body: str, *, first_line: int = 1) -> ParsedArticle:
    """Разрезать текст статьи на блоки шаблона и собрать всё, что в нём не так."""
    tokens = MARKDOWN.parse(body)
    lines = body.splitlines()
    problems: list[str] = []

    for token in tokens:
        if token.type == "heading_open" and token.tag == "h1":
            problems.append(
                f"строка {_line(token, first_line)}: заголовок первого уровня в статье недопустим, "
                "блоки начинаются с «## »"
            )

    headings = [
        (index, token)
        for index, token in enumerate(tokens)
        if token.type == "heading_open" and token.tag == "h2" and token.level == 0
    ]
    first_heading = headings[0][0] if headings else len(tokens)
    if first_heading > 0:
        problems.append(
            f"строка {_line(tokens[0], first_line)}: текст вне блоков — "
            f"статья состоит только из блоков {_TEMPLATE_HEADINGS}"
        )

    blocks: list[ArticleBlock] = []
    seen: set[BlockKind] = set()
    for number, (index, heading) in enumerate(headings):
        title = tokens[index + 1].content.strip()
        where = f"строка {_line(heading, first_line)}"
        kind = _KIND_BY_HEADING.get(title)
        if kind is None:
            problems.append(
                f"{where}: неизвестный блок «{title}»; допустимые блоки: {_TEMPLATE_HEADINGS}"
            )
            continue
        if kind in seen:
            problems.append(f"{where}: блок «{title}» повторяется")
            continue
        seen.add(kind)

        start = heading.map[1] if heading.map else 0
        following = headings[number + 1][1] if number + 1 < len(headings) else None
        end = following.map[0] if following and following.map else len(lines)
        markdown = _trim_blank_lines(lines[start:end])
        if not markdown:
            problems.append(f"{where}: блок «{title}» пуст")
            continue
        blocks.append(ArticleBlock(kind=kind, markdown=markdown))

    kinds = [block.kind for block in blocks]
    if kinds != sorted(kinds, key=_TEMPLATE_POSITION.__getitem__):
        written = ", ".join(f"«{_heading_of(kind)}»" for kind in kinds)
        problems.append(
            f"нарушен порядок блоков: записаны {written}, ожидается порядок {_TEMPLATE_HEADINGS}"
        )

    links, link_problems = _collect_links(tokens, first_line)
    return ParsedArticle(
        blocks=tuple(blocks),
        topic_links=tuple(links),
        problems=tuple(problems + link_problems),
    )


def _collect_links(tokens: Sequence[Token], first_line: int) -> tuple[list[TopicLink], list[str]]:
    links: list[TopicLink] = []
    problems: list[str] = []
    for href, line in _link_addresses(tokens, first_line):
        if href.startswith(TOPIC_LINK_SCHEME):
            links.append(TopicLink(topic_id=href.removeprefix(TOPIC_LINK_SCHEME), line=line))
        elif not href.startswith(EXTERNAL_LINK_SCHEMES):
            problems.append(
                f"строка {line}: ссылка с адресом «{href}» — на тему ссылаются адресом "
                "вида topic:<id>, на внешнюю страницу — полным адресом с https://"
            )
    return links, problems


def _link_addresses(tokens: Sequence[Token], first_line: int) -> Iterator[tuple[str, int]]:
    for token in tokens:
        for child in token.children or ():
            if child.type == "link_open":
                yield str(child.attrGet("href") or ""), _line(token, first_line)


def _line(token: Token, first_line: int) -> int:
    return first_line + (token.map[0] if token.map else 0)


def _heading_of(kind: BlockKind) -> str:
    return ARTICLE_TEMPLATE[_TEMPLATE_POSITION[kind]][1]


def _trim_blank_lines(lines: Sequence[str]) -> str:
    start, end = 0, len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    return "\n".join(lines[start:end])
