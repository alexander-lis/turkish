"""Выделение фрагмента звёздочками в текстах примеров."""

from turkish_grammar.content.errors import ContentFormatError
from turkish_grammar.content.model import MarkedText, TextSegment

EMPHASIS_MARK = "*"


def parse_emphasis(raw: str) -> MarkedText:
    """Разобрать текст вида ``Ev*de*yim.`` на чистый текст и отрезки с признаком выделения."""
    pieces = raw.split(EMPHASIS_MARK)
    if len(pieces) % 2 == 0:
        raise ContentFormatError("звёздочка выделения без пары")

    segments: list[TextSegment] = []
    for position, piece in enumerate(pieces):
        emphasized = position % 2 == 1
        if emphasized and not piece:
            raise ContentFormatError("пустое выделение: между звёздочками нет текста")
        if piece:
            segments.append(TextSegment(text=piece, emphasized=emphasized))
    return MarkedText(text="".join(pieces), segments=tuple(segments))
