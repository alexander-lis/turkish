from turkish_grammar.content.turkish import comparable, turkish_lower


def test_dotless_capital_i_becomes_dotless_small_i() -> None:
    assert turkish_lower("IRMAK") == "ırmak"


def test_dotted_capital_i_becomes_plain_small_i() -> None:
    assert turkish_lower("İSTANBUL") == "istanbul"


def test_dotted_capital_i_written_with_combining_dot_becomes_plain_small_i() -> None:
    assert turkish_lower("İstanbul") == "istanbul"


def test_other_letters_are_lowered_as_usual() -> None:
    assert turkish_lower("ÇĞÖŞÜ Ev") == "çğöşü ev"


def test_comparable_drops_punctuation_and_collapses_spaces() -> None:
    assert comparable("  İstanbul'da   ılık,  değil mi? ") == "istanbulda ılık değil mi"


def test_comparable_drops_hyphens_between_morphemes() -> None:
    assert comparable("ev-ler-im-de") == "evlerimde"
