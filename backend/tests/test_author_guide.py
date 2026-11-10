"""Образцы из руководства автора должны проходить ту же проверку, что и настоящий контент."""

import re

import yaml

from tests.support import ContentBuilder
from turkish_grammar.content.loader import load_known_words
from turkish_grammar.settings import REPO_ROOT

GUIDE = REPO_ROOT / "content" / "README.md"

# Образец файла в руководстве: строка, которая начинается с пути в обратных кавычках,
# и блок кода сразу после неё.
SAMPLE = re.compile(
    r"^`content/(?P<path>[^`]+)`[^\n]*\n\n```\w*\n(?P<body>.*?)^```",
    re.MULTILINE | re.DOTALL,
)

# Пример разбора в разделе «Соглашения разбора»: строка `morphemes`, тире и строка `gloss`.
GLOSS_SAMPLE = re.compile(r"`(?P<morphemes>[^`\n]+)` — `(?P<gloss>[^`\n]+)`")
CONVENTION = re.compile(r"^\d+\. .*$", re.MULTILINE)


def test_samples_from_author_guide_pass_content_check(content: ContentBuilder) -> None:
    samples = {match["path"]: match["body"] for match in SAMPLE.finditer(GUIDE.read_text("utf-8"))}
    assert samples.keys() >= {
        "topics/locative-da/topic.md",
        "topics/locative-da/examples.yaml",
        "topics/ablative-dan/topic.md",
        "sections.yaml",
        "path.yaml",
        "abbreviations.yaml",
        "known-words.yaml",
    }

    # Темы, на которые образцы ссылаются, но которые руководство не приводит.
    content.topic("vowel-harmony", section="phonetics")
    content.topic("consonant-assimilation", section="phonetics")
    for path, body in samples.items():
        content.write(path, body)

    catalog = content.load()
    known_words, known_words_issues = load_known_words(content.root)

    assert len(catalog.topic("locative-da").blocks) == 4
    assert len(catalog.topic("locative-da").examples) == 3
    assert catalog.topic("ablative-dan").is_stub
    assert len(known_words) == 1
    assert known_words_issues == ()


def test_every_gloss_convention_has_example_that_passes_content_check(
    content: ContentBuilder,
) -> None:
    conventions = CONVENTION.findall(_section(GUIDE.read_text("utf-8"), "Соглашения разбора"))
    assert len(conventions) == 12

    examples = []
    for convention in conventions:
        samples = list(GLOSS_SAMPLE.finditer(convention))
        assert samples, f"в соглашении нет примера разбора: {convention[:60]}"
        examples += [
            {
                "tr": sample["morphemes"].replace("-", ""),
                "ru": "перевод",
                "morphemes": sample["morphemes"],
                "gloss": sample["gloss"],
            }
            for sample in samples
        ]

    # Обозначения берутся настоящие: разборы руководства пишутся теми же кодами, что и контент.
    abbreviations = (REPO_ROOT / "content" / "abbreviations.yaml").read_text("utf-8")
    content.write("abbreviations.yaml", abbreviations)
    content.topic(
        "gloss-conventions",
        article="## Формула\n\nОснова и аффикс.\n",
        examples=yaml.safe_dump(examples, allow_unicode=True),
    )

    catalog = content.load()

    assert len(catalog.topic("gloss-conventions").examples) == len(examples)


def _section(guide: str, heading: str) -> str:
    """Текст раздела руководства от его заголовка второго уровня до следующего такого же."""
    start = guide.index(f"\n## {heading}\n")
    end = guide.find("\n## ", start + 1)
    return guide[start : end if end != -1 else len(guide)]
