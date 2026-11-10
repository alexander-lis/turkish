"""Операции API. Все они только читают каталог, загруженный при старте."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status

from turkish_grammar.api import schemas
from turkish_grammar.content.model import Catalog, Topic

router = APIRouter(prefix="/api")


def get_catalog(request: Request) -> Catalog:
    catalog: Catalog = request.app.state.catalog
    return catalog


CatalogDep = Annotated[Catalog, Depends(get_catalog)]


@router.get("/topics", summary="Все темы в порядке учебного маршрута")
def list_topics(catalog: CatalogDep) -> list[schemas.TopicSummary]:
    return [schemas.TopicSummary.model_validate(topic) for topic in catalog.topics]


@router.get("/sections", summary="Все разделы в порядке, заданном в контенте")
def list_sections(catalog: CatalogDep) -> list[schemas.Section]:
    return [schemas.Section.model_validate(section) for section in catalog.sections]


@router.get(
    "/topics/{id}",
    summary="Тема целиком: статья, примеры и ссылки на другие темы",
    responses={status.HTTP_404_NOT_FOUND: {"model": schemas.ErrorResponse}},
)
def get_topic(
    topic_id: Annotated[str, Path(alias="id")], catalog: CatalogDep
) -> schemas.TopicDetail:
    topic = catalog.find_topic(topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Тема «{topic_id}» не найдена")

    previous, following = catalog.neighbours(topic.id)
    return schemas.TopicDetail(
        **schemas.TopicSummary.model_validate(topic).model_dump(),
        section=schemas.Section.model_validate(catalog.section(topic.section_id)),
        blocks=[schemas.ArticleBlock.model_validate(block) for block in topic.blocks],
        examples=[schemas.Example.model_validate(example) for example in topic.examples],
        prerequisites=[_ref(catalog.topic(other)) for other in topic.prerequisites],
        related=[_ref(catalog.topic(other)) for other in topic.related],
        previous=_ref(previous) if previous else None,
        next=_ref(following) if following else None,
    )


@router.get("/notation", summary="Вводный текст и список обозначений")
def get_notation(catalog: CatalogDep) -> schemas.Notation:
    return schemas.Notation(
        intro_markdown=catalog.notation_markdown,
        abbreviations=[
            schemas.Abbreviation.model_validate(abbreviation)
            for abbreviation in catalog.abbreviations
        ],
    )


def _ref(topic: Topic) -> schemas.TopicRef:
    return schemas.TopicRef.model_validate(topic)
