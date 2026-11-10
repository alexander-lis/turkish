"""Образцы из руководства автора должны проходить ту же проверку, что и настоящий контент."""

import re

from tests.support import ContentBuilder
from turkish_grammar.settings import REPO_ROOT

GUIDE = REPO_ROOT / "content" / "README.md"

# Образец файла в руководстве: строка, которая начинается с пути в обратных кавычках,
# и блок кода сразу после неё.
SAMPLE = re.compile(
    r"^`content/(?P<path>[^`]+)`[^\n]*\n\n```\w*\n(?P<body>.*?)^```",
    re.MULTILINE | re.DOTALL,
)


def test_samples_from_author_guide_pass_content_check(content: ContentBuilder) -> None:
    samples = {match["path"]: match["body"] for match in SAMPLE.finditer(GUIDE.read_text("utf-8"))}
    assert samples.keys() >= {
        "topics/locative-da/topic.md",
        "topics/locative-da/examples.yaml",
        "topics/ablative-dan/topic.md",
        "sections.yaml",
        "path.yaml",
        "abbreviations.yaml",
    }

    # Темы, на которые образцы ссылаются, но которые руководство не приводит.
    content.topic("vowel-harmony", section="phonetics")
    content.topic("consonant-assimilation", section="phonetics")
    for path, body in samples.items():
        content.write(path, body)

    catalog = content.load()

    assert len(catalog.topic("locative-da").blocks) == 4
    assert len(catalog.topic("locative-da").examples) == 3
    assert catalog.topic("ablative-dan").is_stub
