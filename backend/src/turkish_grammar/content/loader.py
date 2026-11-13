"""Загрузка контента из файлов и его проверка в два прохода: каждый файл сам по себе, затем связи.

Собирает все ошибки, а не только первую.
"""

from collections import Counter
from dataclasses import dataclass
from itertools import pairwise
from pathlib import Path

import yaml
from pydantic import BaseModel, ValidationError

from turkish_grammar.content.article import (
    TopicLink,
    parse_article,
    parse_markdown_links,
    split_frontmatter,
)
from turkish_grammar.content.errors import ContentFormatError, ContentIssue, InvalidContentError
from turkish_grammar.content.files import (
    AbbreviationEntry,
    ExampleEntry,
    KnownWordEntry,
    SectionEntry,
    TopicMeta,
    describe_validation_error,
)
from turkish_grammar.content.gloss import (
    GLOSS_PART_SEPARATOR,
    MORPHEME_SEPARATOR,
    GlossError,
    check_gloss_matches_text,
    is_abbreviation,
    parse_gloss,
)
from turkish_grammar.content.markup import parse_emphasis
from turkish_grammar.content.model import (
    ID_PATTERN,
    LEVEL_ORDER,
    Abbreviation,
    Catalog,
    Example,
    GlossedWord,
    KnownWord,
    MarkedText,
    Section,
    Topic,
)
from turkish_grammar.content.turkish import turkish_lower

TOPICS_DIR = "topics"
TOPIC_FILE = "topic.md"
EXAMPLES_FILE = "examples.yaml"
SECTIONS_FILE = "sections.yaml"
PATH_FILE = "path.yaml"
ABBREVIATIONS_FILE = "abbreviations.yaml"
NOTATION_FILE = "notation.md"
KNOWN_WORDS_FILE = "known-words.yaml"

_ID_RULE = "допустимы строчные латинские буквы, цифры и дефисы между ними"


class _Report:
    def __init__(self) -> None:
        self.issues: list[ContentIssue] = []

    def add(self, path: str, message: str) -> None:
        self.issues.append(ContentIssue(path=path, message=message))


@dataclass(frozen=True)
class _TopicDraft:
    """Тема, прочитанная из своего каталога, до проверки связей с остальным контентом."""

    topic: Topic
    article_links: tuple[TopicLink, ...]


@dataclass(frozen=True)
class _Notation:
    markdown: str
    topic_links: tuple[TopicLink, ...]


def load_catalog(content_dir: Path) -> Catalog:
    """Прочитать и проверить весь контент.

    Если найдена хотя бы одна ошибка, бросает ``InvalidContentError`` со всем списком.
    """
    report = _Report()

    sections = _read_sections(content_dir, report)
    abbreviations = _read_abbreviations(content_dir, report)
    notation = _read_notation(content_dir, report)
    path = _read_path(content_dir, report)
    topic_ids, drafts = _read_topics(content_dir, report)

    all_topics_read = len(drafts) == len(topic_ids)
    if sections is not None:
        _check_sections(sections, drafts, report, report_unused=all_topics_read)
    _check_topic_references(drafts, topic_ids, report)
    if path is not None:
        _check_path(path, drafts, topic_ids, report)
    _check_text_links(drafts, notation, topic_ids, report)
    if abbreviations is not None:
        _check_gloss_abbreviations(drafts, abbreviations, report)

    if (
        report.issues
        or sections is None
        or abbreviations is None
        or notation is None
        or path is None
    ):
        raise InvalidContentError(report.issues)

    topics = {draft.topic.id: draft.topic for draft in drafts}
    return Catalog(
        sections=sections,
        topics=tuple(topics[topic_id] for topic_id in path),
        abbreviations=abbreviations,
        notation_markdown=notation.markdown,
    )


def load_known_words(content_dir: Path) -> tuple[tuple[KnownWord, ...], tuple[ContentIssue, ...]]:
    """Прочитать список известных слов и собрать ошибки в нём самом.

    Файла может не быть: тогда список пуст. В проверку целостности список не входит,
    поэтому ошибки возвращаются, а не бросаются.
    """
    report = _Report()
    items = _read_yaml_list(content_dir, KNOWN_WORDS_FILE, report, required=False) or []
    words: list[KnownWord] = []
    seen: set[str] = set()
    for number, item in enumerate(items, 1):
        entry = _validate(
            KnownWordEntry, item, KNOWN_WORDS_FILE, report, where=f"запись {number}: "
        )
        if entry is None:
            continue
        reason = (entry.reason or "").strip()
        if not reason:
            report.add(KNOWN_WORDS_FILE, f"слово «{entry.word}»: не указана причина")
        if turkish_lower(entry.word) in seen:
            report.add(KNOWN_WORDS_FILE, f"слово «{entry.word}» записано больше одного раза")
            continue
        seen.add(turkish_lower(entry.word))
        words.append(KnownWord(word=entry.word, reason=reason))
    return tuple(words), tuple(report.issues)


# --- Первый проход: каждый файл сам по себе ---


def _read_text(root: Path, rel: str, report: _Report) -> str | None:
    try:
        return (root / rel).read_text(encoding="utf-8")
    except UnicodeDecodeError:
        report.add(rel, "файл должен быть в кодировке UTF-8")
        return None


def _parse_yaml(text: str, rel: str, report: _Report) -> tuple[bool, object]:
    try:
        return True, yaml.safe_load(text)
    except yaml.YAMLError as error:
        mark = getattr(error, "problem_mark", None)
        problem = getattr(error, "problem", None) or str(error)
        where = f"строка {mark.line + 1}: " if mark is not None else ""
        report.add(rel, f"{where}не удалось разобрать YAML: {problem}")
        return False, None


def _read_yaml_list(
    root: Path, rel: str, report: _Report, *, required: bool
) -> list[object] | None:
    """Прочитать файл со списком. ``None`` — файла нет или он не читается."""
    if not (root / rel).is_file():
        if required:
            report.add(rel, "файл не найден")
        return None
    text = _read_text(root, rel, report)
    if text is None:
        return None
    parsed, data = _parse_yaml(text, rel, report)
    if not parsed:
        return None
    if data is None:
        return []
    if not isinstance(data, list):
        report.add(rel, "в файле должен быть список")
        return None
    return data


def _validate[EntryT: BaseModel](
    model: type[EntryT], raw: object, rel: str, report: _Report, *, where: str = ""
) -> EntryT | None:
    if not isinstance(raw, dict):
        report.add(rel, f"{where}ожидается набор полей «имя: значение»")
        return None
    try:
        return model.model_validate(raw)
    except ValidationError as error:
        for message in describe_validation_error(error):
            report.add(rel, f"{where}{message}")
        return None


def _read_sections(root: Path, report: _Report) -> tuple[Section, ...] | None:
    items = _read_yaml_list(root, SECTIONS_FILE, report, required=True)
    if items is None:
        return None
    sections: list[Section] = []
    seen: set[str] = set()
    for number, item in enumerate(items, 1):
        entry = _validate(SectionEntry, item, SECTIONS_FILE, report, where=f"раздел {number}: ")
        if entry is None:
            continue
        if not ID_PATTERN.fullmatch(entry.id):
            report.add(
                SECTIONS_FILE, f"недопустимый идентификатор раздела «{entry.id}»: {_ID_RULE}"
            )
        elif entry.id in seen:
            report.add(SECTIONS_FILE, f"раздел «{entry.id}» задан больше одного раза")
        else:
            seen.add(entry.id)
            sections.append(Section(id=entry.id, title=entry.title))
    return tuple(sections)


def _read_abbreviations(root: Path, report: _Report) -> tuple[Abbreviation, ...] | None:
    items = _read_yaml_list(root, ABBREVIATIONS_FILE, report, required=True)
    if items is None:
        return None
    abbreviations: list[Abbreviation] = []
    seen: set[str] = set()
    for number, item in enumerate(items, 1):
        entry = _validate(
            AbbreviationEntry, item, ABBREVIATIONS_FILE, report, where=f"обозначение {number}: "
        )
        if entry is None:
            continue
        if not _is_valid_code(entry.code):
            report.add(
                ABBREVIATIONS_FILE,
                f"недопустимый код «{entry.code}»: код пишется заглавными буквами "
                "без пробелов, точек и дефисов",
            )
        elif entry.code in seen:
            report.add(ABBREVIATIONS_FILE, f"код «{entry.code}» задан больше одного раза")
        else:
            seen.add(entry.code)
            abbreviations.append(Abbreviation(code=entry.code, meaning=entry.meaning))
    return tuple(abbreviations)


def _is_valid_code(code: str) -> bool:
    has_separator = any(
        ch.isspace() or ch in (MORPHEME_SEPARATOR, GLOSS_PART_SEPARATOR) for ch in code
    )
    return is_abbreviation(code) and not has_separator


def _read_notation(root: Path, report: _Report) -> _Notation | None:
    if not (root / NOTATION_FILE).is_file():
        report.add(NOTATION_FILE, "файл не найден")
        return None
    text = _read_text(root, NOTATION_FILE, report)
    if text is None:
        return None
    if not text.strip():
        report.add(NOTATION_FILE, "файл пуст: в нём должно быть пояснение к обозначениям")
        return None
    parsed = parse_markdown_links(text)
    for problem in parsed.problems:
        report.add(NOTATION_FILE, problem)
    return _Notation(markdown=text.strip(), topic_links=parsed.topic_links)


def _read_path(root: Path, report: _Report) -> tuple[str, ...] | None:
    items = _read_yaml_list(root, PATH_FILE, report, required=True)
    if items is None:
        return None
    path: list[str] = []
    for number, item in enumerate(items, 1):
        if isinstance(item, str):
            path.append(item)
        else:
            report.add(PATH_FILE, f"элемент {number}: ожидается идентификатор темы")
    for topic_id, count in Counter(path).items():
        if count > 1:
            report.add(PATH_FILE, f"тема «{topic_id}» встречается в маршруте {count} раза")
    return tuple(dict.fromkeys(path))


def _read_topics(root: Path, report: _Report) -> tuple[set[str], list[_TopicDraft]]:
    """Прочитать все каталоги тем.

    Возвращает идентификаторы всех тем, у которых есть ``topic.md``, и темы, которые удалось
    прочитать. Первое нужно, чтобы тема с испорченными метаданными не порождала ещё и ошибки
    «такой темы нет» во всех темах, которые на неё ссылаются.
    """
    topics_dir = root / TOPICS_DIR
    if not topics_dir.is_dir():
        report.add(TOPICS_DIR, "каталог тем не найден")
        return set(), []

    topic_ids: set[str] = set()
    drafts: list[_TopicDraft] = []
    for entry in sorted(topics_dir.iterdir()):
        rel = f"{TOPICS_DIR}/{entry.name}"
        if entry.name.startswith("."):
            continue
        if not entry.is_dir():
            report.add(rel, "в каталоге тем лежат только каталоги тем")
            continue
        if not ID_PATTERN.fullmatch(entry.name):
            report.add(rel, f"недопустимый идентификатор темы «{entry.name}»: {_ID_RULE}")
            continue
        if not (entry / TOPIC_FILE).is_file():
            report.add(rel, f"в каталоге темы нет файла {TOPIC_FILE}")
            continue
        topic_ids.add(entry.name)
        for extra in sorted(entry.iterdir()):
            if extra.name not in (TOPIC_FILE, EXAMPLES_FILE) and not extra.name.startswith("."):
                report.add(
                    f"{rel}/{extra.name}",
                    f"лишний файл: в каталоге темы лежат только {TOPIC_FILE} и {EXAMPLES_FILE}",
                )
        draft = _read_topic(root, entry.name, report)
        if draft is not None:
            drafts.append(draft)
    return topic_ids, drafts


def _read_topic(root: Path, topic_id: str, report: _Report) -> _TopicDraft | None:
    rel = f"{TOPICS_DIR}/{topic_id}/{TOPIC_FILE}"
    text = _read_text(root, rel, report)
    if text is None:
        return None
    try:
        metadata_text, body, body_line = split_frontmatter(text)
    except ContentFormatError as error:
        report.add(rel, str(error))
        return None

    meta: TopicMeta | None = None
    parsed, raw_meta = _parse_yaml(metadata_text, rel, report)
    if parsed:
        meta = _validate(TopicMeta, raw_meta, rel, report, where="метаданные: ")

    article = parse_article(body, first_line=body_line)
    for problem in article.problems:
        report.add(rel, problem)

    examples, examples_readable = _read_examples(root, topic_id, report)
    if article.blocks and not examples and examples_readable:
        report.add(
            f"{TOPICS_DIR}/{topic_id}",
            f"у темы есть статья, но нет ни одного примера: добавьте их в {EXAMPLES_FILE}",
        )

    if meta is None:
        return None
    _check_own_references(topic_id, meta, rel, report)
    return _TopicDraft(
        topic=Topic(
            id=topic_id,
            title=meta.title,
            section_id=meta.section,
            level=meta.level,
            summary=meta.summary,
            prerequisites=tuple(meta.prerequisites),
            related=tuple(meta.related),
            blocks=article.blocks,
            examples=examples,
        ),
        article_links=article.topic_links,
    )


def _check_own_references(topic_id: str, meta: TopicMeta, rel: str, report: _Report) -> None:
    for field, ids in (("prerequisites", meta.prerequisites), ("related", meta.related)):
        if topic_id in ids:
            report.add(rel, f"поле `{field}`: тема ссылается сама на себя")
        for other, count in Counter(ids).items():
            if count > 1:
                report.add(rel, f"поле `{field}`: тема «{other}» указана больше одного раза")


def _read_examples(root: Path, topic_id: str, report: _Report) -> tuple[tuple[Example, ...], bool]:
    """Прочитать примеры темы. Второе значение ложно, если файл есть, но не читается."""
    rel = f"{TOPICS_DIR}/{topic_id}/{EXAMPLES_FILE}"
    if not (root / rel).is_file():
        return (), True
    items = _read_yaml_list(root, rel, report, required=False)
    if items is None:
        return (), False

    examples: list[Example] = []
    readable = True
    for number, item in enumerate(items, 1):
        example = _read_example(item, rel, report, where=f"пример {number}: ")
        if example is None:
            readable = False
        else:
            examples.append(example)
    return tuple(examples), readable


def _read_example(item: object, rel: str, report: _Report, *, where: str) -> Example | None:
    entry = _validate(ExampleEntry, item, rel, report, where=where)
    if entry is None:
        return None

    texts: dict[str, MarkedText] = {}
    for field, raw in (("tr", entry.tr), ("ru", entry.ru)):
        try:
            texts[field] = parse_emphasis(raw)
        except ContentFormatError as error:
            report.add(rel, f"{where}поле `{field}`: {error}")

    gloss: tuple[GlossedWord, ...] | None = None
    gloss_ok = True
    if (entry.morphemes is None) != (entry.gloss is None):
        report.add(rel, f"{where}поля `morphemes` и `gloss` задаются только вместе")
        gloss_ok = False
    elif entry.morphemes is not None and entry.gloss is not None:
        try:
            gloss = parse_gloss(entry.morphemes, entry.gloss)
            if "tr" in texts:
                check_gloss_matches_text(entry.morphemes, texts["tr"].text)
        except GlossError as error:
            for message in error.messages:
                report.add(rel, f"{where}{message}")
            gloss_ok = False
        except ContentFormatError as error:
            report.add(rel, f"{where}{error}")
            gloss_ok = False

    if len(texts) < 2 or not gloss_ok:
        return None
    return Example(
        tr=texts["tr"], ru=texts["ru"], source=entry.source, note=entry.note, gloss=gloss
    )


# --- Второй проход: связи между файлами ---


def _topic_file(topic_id: str) -> str:
    return f"{TOPICS_DIR}/{topic_id}/{TOPIC_FILE}"


def _check_sections(
    sections: tuple[Section, ...],
    drafts: list[_TopicDraft],
    report: _Report,
    *,
    report_unused: bool,
) -> None:
    known = {section.id for section in sections}
    used: set[str] = set()
    for draft in drafts:
        topic = draft.topic
        used.add(topic.section_id)
        if topic.section_id not in known:
            report.add(
                _topic_file(topic.id),
                f"неизвестный раздел «{topic.section_id}»: его нет в {SECTIONS_FILE}",
            )
    if report_unused:
        for section in sections:
            if section.id not in used:
                report.add(SECTIONS_FILE, f"в разделе «{section.id}» нет ни одной темы")


def _check_topic_references(
    drafts: list[_TopicDraft], topic_ids: set[str], report: _Report
) -> None:
    for draft in drafts:
        topic = draft.topic
        references = (("пререквизит", topic.prerequisites), ("связанная тема", topic.related))
        for role, ids in references:
            for other in ids:
                if other not in topic_ids:
                    report.add(_topic_file(topic.id), f"{role} «{other}»: такой темы нет")


def _check_path(
    path: tuple[str, ...], drafts: list[_TopicDraft], topic_ids: set[str], report: _Report
) -> None:
    position = {topic_id: index for index, topic_id in enumerate(path)}
    for topic_id in path:
        if topic_id not in topic_ids:
            report.add(PATH_FILE, f"тема «{topic_id}» есть в маршруте, но такой темы нет")
    for topic_id in sorted(topic_ids - position.keys()):
        report.add(PATH_FILE, f"тема «{topic_id}» не включена в учебный маршрут")

    topics = {draft.topic.id: draft.topic for draft in drafts}
    for topic in topics.values():
        for prerequisite in topic.prerequisites:
            if (
                topic.id in position
                and prerequisite in position
                and prerequisite != topic.id
                and position[prerequisite] > position[topic.id]
            ):
                report.add(
                    PATH_FILE,
                    f"тема «{topic.id}» стоит в маршруте раньше "
                    f"своего пререквизита «{prerequisite}»",
                )

    in_path = [topics[topic_id] for topic_id in path if topic_id in topics]
    for previous, current in pairwise(in_path):
        if LEVEL_ORDER[current.level] < LEVEL_ORDER[previous.level]:
            report.add(
                PATH_FILE,
                f"тема «{current.id}» уровня {current.level} стоит после "
                f"темы «{previous.id}» уровня {previous.level}: уровни в маршруте не убывают",
            )


def _check_text_links(
    drafts: list[_TopicDraft], notation: _Notation | None, topic_ids: set[str], report: _Report
) -> None:
    sources = [(_topic_file(draft.topic.id), draft.article_links) for draft in drafts]
    if notation is not None:
        sources.append((NOTATION_FILE, notation.topic_links))
    for rel, links in sources:
        for link in links:
            if link.topic_id not in topic_ids:
                report.add(
                    rel,
                    f"строка {link.line}: ссылка «topic:{link.topic_id}» — такой темы нет",
                )


def _check_gloss_abbreviations(
    drafts: list[_TopicDraft], abbreviations: tuple[Abbreviation, ...], report: _Report
) -> None:
    codes = {abbreviation.code for abbreviation in abbreviations}
    for draft in drafts:
        rel = f"{TOPICS_DIR}/{draft.topic.id}/{EXAMPLES_FILE}"
        for number, example in enumerate(draft.topic.examples, 1):
            unknown = dict.fromkeys(
                part.text
                for word in example.gloss or ()
                for morpheme in word.morphemes
                for part in morpheme.parts
                if part.is_abbreviation and part.text not in codes
            )
            for code in unknown:
                report.add(
                    rel,
                    f"пример {number}: обозначения «{code}» нет в {ABBREVIATIONS_FILE}",
                )
