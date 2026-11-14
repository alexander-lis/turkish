"""Операции API. Все они только читают то, что построено при старте:
каталог, граф тем и поисковый индекс.
"""

from collections.abc import Iterable
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Request, status

from turkish_grammar.api import schemas
from turkish_grammar.content.graph import TopicGraph
from turkish_grammar.content.model import Catalog, Topic
from turkish_grammar.content.search_index import SearchTopic

router = APIRouter(prefix="/api")


def get_catalog(request: Request) -> Catalog:
    catalog: Catalog = request.app.state.catalog
    return catalog


def get_topic_graph(request: Request) -> TopicGraph:
    graph: TopicGraph = request.app.state.graph
    return graph


def get_search_topics(request: Request) -> tuple[SearchTopic, ...]:
    index: tuple[SearchTopic, ...] = request.app.state.search_index
    return index


CatalogDep = Annotated[Catalog, Depends(get_catalog)]
GraphDep = Annotated[TopicGraph, Depends(get_topic_graph)]
SearchIndexDep = Annotated[tuple[SearchTopic, ...], Depends(get_search_topics)]


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
    topic_id: Annotated[str, Path(alias="id")], catalog: CatalogDep, graph: GraphDep
) -> schemas.TopicDetail:
    topic = catalog.find_topic(topic_id)
    if topic is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"Тема «{topic_id}» не найдена")

    def refs(topic_ids: Iterable[str]) -> list[schemas.TopicRef]:
        return [_ref(catalog.topic(other)) for other in topic_ids]

    previous, following = catalog.neighbours(topic.id)
    return schemas.TopicDetail(
        **schemas.TopicSummary.model_validate(topic).model_dump(),
        section=schemas.Section.model_validate(catalog.section(topic.section_id)),
        blocks=[schemas.ArticleBlock.model_validate(block) for block in topic.blocks],
        examples=[schemas.Example.model_validate(example) for example in topic.examples],
        prerequisites=refs(topic.prerequisites),
        overviews=refs(graph.overviews_of(topic.id)),
        members=refs(topic.members),
        contrasts=[
            schemas.TopicContrast(
                title=contrast.title,
                topics=refs(other for other in contrast.topics if other != topic.id),
                explained_in=refs(contrast.explained_in),
            )
            for contrast in graph.contrasts_of(topic.id)
        ],
        related=refs(graph.related_of(topic.id)),
        previous=_ref(previous) if previous else None,
        next=_ref(following) if following else None,
    )


@router.get("/graph", summary="Граф тем: все темы, связи между ними и различения")
def get_graph(catalog: CatalogDep, graph: GraphDep) -> schemas.TopicGraph:
    return schemas.TopicGraph(
        topics=[schemas.TopicSummary.model_validate(topic) for topic in catalog.topics],
        edges=[schemas.GraphEdge.model_validate(edge) for edge in graph.edges],
        contrasts=[
            schemas.GraphContrast.model_validate(contrast) for contrast in catalog.contrasts
        ],
    )


@router.get(
    "/search-index",
    summary="Поисковый индекс: все темы с текстом статей без разметки и примерами",
)
def get_search_index(index: SearchIndexDep) -> list[schemas.SearchTopic]:
    return [schemas.SearchTopic.model_validate(topic) for topic in index]


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
