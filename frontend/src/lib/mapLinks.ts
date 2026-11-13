import type { EdgeKind, TopicGraph, TopicSummary } from "../api/types.ts";
import type { MapTree } from "./mapTree.ts";

/*
 * Связи графа тем поверх дерева карты: перекрёстные линии между видимыми темами и списки
 * связей одной темы для панели темы.
 */

/** Слой включает на всей карте связи одного вида. */
export type Layer = "prerequisites" | "contrasts" | "related";

export const LAYERS = {
  prerequisites: "Пререквизиты",
  contrasts: "Различения",
  related: "Связанные темы",
} as const satisfies Record<Layer, string>;

/**
 * Вид перекрёстной линии. «overview» — связь «тема обзора», которая не стала веткой дерева:
 * она часть строения карты и видна всегда.
 */
export type LineKind = "prerequisite" | "contrast" | "related" | "overview";

export interface CrossLine {
  id: string;
  kind: LineKind;
  /** У пререквизита — пререквизит, у связи с обзором — обзор. */
  source: string;
  target: string;
  /** Линия выбранной темы: рисуется плотнее остальных. */
  selected: boolean;
}

export interface CrossLineOptions {
  layers: ReadonlySet<Layer>;
  selected: string | null;
}

/**
 * Перекрёстные линии между видимыми темами: связи с обзорами вне веток, связи включённых
 * слоёв и все связи выбранной темы. Различение рисуется линиями между каждой парой его тем.
 */
export function crossLines(
  graph: TopicGraph,
  mapTree: MapTree,
  { layers, selected }: CrossLineOptions,
): CrossLine[] {
  const { visible } = mapTree;
  const position = new Map(
    graph.topics.map((topic, index) => [topic.id, index]),
  );
  const lines = new Map<string, CrossLine>();

  function add(kind: LineKind, source: string, target: string, layer: boolean) {
    const touchesSelected = selected === source || selected === target;
    if (!visible.has(source) || !visible.has(target)) {
      return;
    }
    if (!layer && !touchesSelected) {
      return;
    }
    const id = `${kind}:${source}:${target}`;
    lines.set(id, { id, kind, source, target, selected: touchesSelected });
  }

  for (const link of mapTree.overviewLinks) {
    add("overview", link.overview, link.topic, true);
  }
  for (const edge of graph.edges) {
    if (edge.kind === "prerequisite") {
      add(
        "prerequisite",
        edge.source,
        edge.target,
        layers.has("prerequisites"),
      );
    } else if (edge.kind === "related") {
      add("related", edge.source, edge.target, layers.has("related"));
    }
  }
  for (const contrast of graph.contrasts) {
    const members = byPosition(contrast.topics, position);
    members.forEach((source, index) => {
      for (const target of members.slice(index + 1)) {
        add("contrast", source, target, layers.has("contrasts"));
      }
    });
  }
  return [...lines.values()];
}

function byPosition(
  ids: readonly string[],
  position: ReadonlyMap<string, number>,
): string[] {
  return ids
    .filter((id) => position.has(id))
    .sort(
      (a, b) => (position.get(a) ?? Infinity) - (position.get(b) ?? Infinity),
    );
}

interface TopicContrastLinks {
  title: string;
  /** Остальные темы различения. */
  topics: TopicSummary[];
}

/** Связи темы по видам. Внутри каждого списка темы идут в порядке учебного маршрута. */
export interface TopicLinks {
  prerequisites: TopicSummary[];
  requiredFor: TopicSummary[];
  overviews: TopicSummary[];
  members: TopicSummary[];
  contrasts: TopicContrastLinks[];
  related: TopicSummary[];
}

export function topicLinks(graph: TopicGraph, id: string): TopicLinks {
  const position = new Map(
    graph.topics.map((topic, index) => [topic.id, index]),
  );
  const byId = new Map(graph.topics.map((topic) => [topic.id, topic]));
  const summaries = (ids: Iterable<string>): TopicSummary[] =>
    byPosition([...new Set(ids)], position).flatMap((other) => {
      const topic = byId.get(other);
      return topic ? [topic] : [];
    });
  const ends = (kind: EdgeKind, from: "source" | "target") =>
    graph.edges
      .filter((edge) => edge.kind === kind && edge[from] === id)
      .map((edge) => (from === "source" ? edge.target : edge.source));

  return {
    prerequisites: summaries(ends("prerequisite", "target")),
    requiredFor: summaries(ends("prerequisite", "source")),
    overviews: summaries(ends("member", "target")),
    members: summaries(ends("member", "source")),
    contrasts: graph.contrasts
      .filter((contrast) => contrast.topics.includes(id))
      .map((contrast) => ({
        title: contrast.title,
        topics: summaries(contrast.topics.filter((other) => other !== id)),
      })),
    related: summaries([
      ...ends("related", "source"),
      ...ends("related", "target"),
    ]),
  };
}

/** Все темы, связанные с темой хоть одной связью: на карте они не приглушаются. */
export function linkedTopicIds(links: TopicLinks): Set<string> {
  return new Set(
    [
      links.prerequisites,
      links.requiredFor,
      links.overviews,
      links.members,
      links.related,
      ...links.contrasts.map((contrast) => contrast.topics),
    ].flatMap((topics) => topics.map((topic) => topic.id)),
  );
}
