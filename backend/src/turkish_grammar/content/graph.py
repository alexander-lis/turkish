"""Граф тем: связи между темами и то, что из них видно одной теме. Вычисляется из каталога."""

from dataclasses import dataclass, field
from enum import StrEnum
from itertools import combinations

from turkish_grammar.content.model import Catalog, Contrast


class EdgeKind(StrEnum):
    """Вид связи. Порядок значений — от более определённой связи к менее определённой."""

    PREREQUISITE = "prerequisite"
    MEMBER = "member"
    RELATED = "related"


_KIND_ORDER = {kind: position for position, kind in enumerate(EdgeKind)}


@dataclass(frozen=True)
class Edge:
    """Связь между двумя темами.

    У пререквизита начало — пререквизит, у темы обзора — обзор. Связанные темы направления
    не имеют: началом записана та, что стоит раньше в учебном маршруте.
    """

    kind: EdgeKind
    source: str
    target: str


@dataclass(frozen=True)
class TopicGraph:
    """Связи графа тем и обратные индексы для одной темы.

    Связи идут в порядке учебного маршрута темы-начала, затем темы-конца.
    """

    edges: tuple[Edge, ...]
    _overviews: dict[str, tuple[str, ...]] = field(repr=False)
    _contrasts: dict[str, tuple[Contrast, ...]] = field(repr=False)
    _related: dict[str, tuple[str, ...]] = field(repr=False)

    def overviews_of(self, topic_id: str) -> tuple[str, ...]:
        """Обзоры, в которые тема входит, в порядке учебного маршрута."""
        return self._overviews.get(topic_id, ())

    def contrasts_of(self, topic_id: str) -> tuple[Contrast, ...]:
        """Различения, в темы которых тема входит, в порядке их записи в контенте.

        Тема, которая различение только объясняет, его не получает: на её странице
        блок «Не путать» был бы о двух других темах.
        """
        return self._contrasts.get(topic_id, ())

    def related_of(self, topic_id: str) -> tuple[str, ...]:
        """Связанные темы без тех, что страница темы уже показывает другой связью."""
        return self._related.get(topic_id, ())


def build_graph(catalog: Catalog) -> TopicGraph:
    """Построить граф тем. Результат зависит только от каталога."""
    position = {topic.id: index for index, topic in enumerate(catalog.topics)}

    # Темы каталога идут по учебному маршруту, поэтому и обзоры темы — в его порядке.
    overviews: dict[str, list[str]] = {}
    for topic in catalog.topics:
        for member in topic.members:
            overviews.setdefault(member, []).append(topic.id)

    contrasts: dict[str, list[Contrast]] = {}
    for contrast in catalog.contrasts:
        for topic_id in contrast.topics:
            contrasts.setdefault(topic_id, []).append(contrast)

    edges = [
        Edge(EdgeKind.PREREQUISITE, source=prerequisite, target=topic.id)
        for topic in catalog.topics
        for prerequisite in topic.prerequisites
    ]
    edges += [
        Edge(EdgeKind.MEMBER, source=topic.id, target=member)
        for topic in catalog.topics
        for member in topic.members
    ]

    # Связанная тема уступает более определённой связи: пререквизиту и теме обзора
    # в любом направлении и общему различению.
    closer = {frozenset((edge.source, edge.target)) for edge in edges}
    closer |= {
        frozenset(pair)
        for contrast in catalog.contrasts
        for pair in combinations(contrast.topics, 2)
    }
    related_pairs = {
        frozenset((topic.id, other)) for topic in catalog.topics for other in topic.related
    }
    for pair in related_pairs - closer:
        source, target = sorted(pair, key=position.__getitem__)
        edges.append(Edge(EdgeKind.RELATED, source=source, target=target))

    edges.sort(
        key=lambda edge: (position[edge.source], position[edge.target], _KIND_ORDER[edge.kind])
    )

    related: dict[str, tuple[str, ...]] = {}
    for topic in catalog.topics:
        shown = {*topic.prerequisites, *topic.members, *overviews.get(topic.id, ())}
        shown.update(other for contrast in contrasts.get(topic.id, ()) for other in contrast.topics)
        related[topic.id] = tuple(other for other in topic.related if other not in shown)

    return TopicGraph(
        edges=tuple(edges),
        _overviews={topic_id: tuple(ids) for topic_id, ids in overviews.items()},
        _contrasts={topic_id: tuple(found) for topic_id, found in contrasts.items()},
        _related=related,
    )
