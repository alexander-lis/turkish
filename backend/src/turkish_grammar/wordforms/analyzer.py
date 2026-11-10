"""Морфологический анализатор zeyrek. Весь код, который знает о библиотеке, лежит здесь.

zeyrek — зависимость разработки, поэтому он импортируется при первом обращении, а не вместе
с модулем: серверу он не нужен.
"""

import logging
import os
from functools import cache
from typing import Any

_RECOGNIZED = 0
_REJECTED = 1
_FAILED = 2


class AnalyzerError(RuntimeError):
    """Анализатор не дал ответа о слове."""


def is_recognized(word: str) -> bool:
    """Признаёт ли анализатор слово словоформой турецкого языка.

    У zeyrek портится внутреннее состояние: после разбора ``olmak`` он перестаёт признавать
    ``olarak``. Поэтому каждое слово разбирается в отдельном дочернем процессе. Потомок видит
    анализатор таким, каким его загрузил родитель, и его изменения исчезают вместе с ним.
    """
    analyzer = _load_analyzer()
    pid = os.fork()
    if pid == 0:
        exit_code = _FAILED
        try:
            # Библиотека пишет в общий журнал; в отчёт проверки это попадать не должно.
            logging.disable(logging.CRITICAL)
            # Публичный analyze() принимает текст и сам делит его на слова,
            # а здесь нужен ответ ровно про одно слово.
            exit_code = _RECOGNIZED if analyzer._parse(word) else _REJECTED
        finally:
            os._exit(exit_code)
    _, status = os.waitpid(pid, 0)
    exit_code = os.waitstatus_to_exitcode(status)
    if exit_code not in (_RECOGNIZED, _REJECTED):
        raise AnalyzerError(f"анализатор не смог разобрать слово «{word}»")
    return exit_code == _RECOGNIZED


@cache
def _load_analyzer() -> Any:
    """Загрузить анализатор один раз. Сам родительский процесс им ничего не разбирает."""
    import zeyrek

    return zeyrek.MorphAnalyzer()
