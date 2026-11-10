"""Особенности турецкого письма, которые нужны для сверки текстов."""

import unicodedata


def turkish_lower(text: str) -> str:
    """Нижний регистр по правилам турецкого алфавита: I → ı, İ → i.

    Обычный ``str.lower()`` превращает ``I`` в ``i``, а ``İ`` — в ``i`` с отдельным знаком точки,
    поэтому эти две буквы заменяются заранее.
    """
    normalized = unicodedata.normalize("NFC", text)
    return normalized.replace("I", "ı").replace("İ", "i").lower()


def comparable(text: str) -> str:
    """Текст для сверки: без пунктуации, с одиночными пробелами, в турецком нижнем регистре.

    Пунктуация — всё, что Unicode относит к знакам препинания: точки, запятые, апостроф, дефис.
    """
    normalized = unicodedata.normalize("NFC", text)
    letters = "".join(ch for ch in normalized if not unicodedata.category(ch).startswith("P"))
    return " ".join(turkish_lower(letters).split())
