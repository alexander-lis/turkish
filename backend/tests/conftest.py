from pathlib import Path

import pytest

from tests.support import ContentBuilder


@pytest.fixture
def content(tmp_path: Path) -> ContentBuilder:
    return ContentBuilder(tmp_path / "content")
