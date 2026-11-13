"""Приложение FastAPI."""

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from turkish_grammar.api.routes import router
from turkish_grammar.content.errors import InvalidContentError
from turkish_grammar.content.graph import build_graph
from turkish_grammar.content.loader import load_catalog
from turkish_grammar.settings import Settings

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Собрать приложение.

    Контент читается не здесь, а при старте сервера: так описание API можно получить
    и без каталога контента.
    """
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        try:
            catalog = load_catalog(settings.content_dir)
        except InvalidContentError as error:
            # С невалидным контентом сервер не стартует: читатель не должен его увидеть.
            logger.error(error.report(settings.content_dir))
            raise
        app.state.catalog = catalog
        app.state.graph = build_graph(catalog)
        yield

    app = FastAPI(
        title="Турецкий грамматический справочник",
        description="Доступ на чтение к проверенному контенту справочника.",
        version="0.1.0",
        openapi_url="/api/openapi.json",
        docs_url="/api/docs",
        redoc_url=None,
        lifespan=lifespan,
        # Имя операции в OpenAPI — имя функции: по нему называются типы в интерфейсе.
        generate_unique_id_function=lambda route: route.name,
    )
    app.include_router(router)
    return app


app = create_app()
