import type { Level, Section, TopicGraph, TopicSummary } from "../api/types.ts";

/*
 * Дерево карты тем: каркас, в котором у каждой видимой темы одно место.
 *
 * Родитель раздела — корень. Родитель темы — первый по учебному маршруту видимый обзор
 * её раздела, в который она входит, иначе — её раздел. Связь «тема обзора», которая
 * не стала веткой дерева, возвращается отдельно: карта рисует её линией.
 */

export interface MapTopicNode {
  kind: "topic";
  id: string;
  topic: TopicSummary;
  children: MapTopicNode[];
}

export interface MapSectionNode {
  kind: "section";
  id: string;
  section: Section;
  /** Число тем раздела на включённых уровнях: и видимых, и скрытых сворачиванием. */
  topicCount: number;
  expanded: boolean;
  /** Темы прямо под разделом; у свёрнутого раздела их нет. */
  children: MapTopicNode[];
}

/** Связь «тема обзора» между видимыми темами, которая не стала веткой дерева. */
interface OverviewLink {
  overview: string;
  topic: string;
}

export interface MapTree {
  /** Разделы с видимыми темами, в порядке контента. */
  sections: MapSectionNode[];
  /** Темы, у которых есть место на карте: уровень включён, раздел развёрнут. */
  visible: ReadonlySet<string>;
  overviewLinks: OverviewLink[];
}

export interface TreeOptions {
  levels: ReadonlySet<Level>;
  expanded: ReadonlySet<string>;
}

export const ROOT_NODE_ID = "root";

export function sectionNodeId(sectionId: string): string {
  return `section:${sectionId}`;
}

export function topicNodeId(topicId: string): string {
  return `topic:${topicId}`;
}

/**
 * Родитель каждой видимой темы, у которой он — обзор. Если обзоры одного раздела входят
 * друг в друга по кругу, тема, с которой круг найден первым по маршруту, встаёт под раздел.
 */
function overviewParents(
  graph: TopicGraph,
  byId: ReadonlyMap<string, TopicSummary>,
  visible: ReadonlySet<string>,
): Map<string, string> {
  const parents = new Map<string, string>();
  // Связи идут в порядке маршрута темы-начала, поэтому первый найденный обзор и есть первый.
  for (const edge of graph.edges) {
    if (edge.kind !== "member" || parents.has(edge.target)) {
      continue;
    }
    const overview = byId.get(edge.source);
    const member = byId.get(edge.target);
    if (
      overview &&
      member &&
      visible.has(overview.id) &&
      visible.has(member.id) &&
      overview.section_id === member.section_id
    ) {
      parents.set(member.id, overview.id);
    }
  }
  for (const topic of graph.topics) {
    const seen = new Set<string>([topic.id]);
    for (
      let parent = parents.get(topic.id);
      parent !== undefined;
      parent = parents.get(parent)
    ) {
      if (seen.has(parent)) {
        // Круг без этой темы разорвётся, когда обход дойдёт до первой его темы.
        if (parent === topic.id) {
          parents.delete(topic.id);
        }
        break;
      }
      seen.add(parent);
    }
  }
  return parents;
}

export function buildMapTree(
  graph: TopicGraph,
  sections: readonly Section[],
  { levels, expanded }: TreeOptions,
): MapTree {
  const byId = new Map(graph.topics.map((topic) => [topic.id, topic]));
  const onLevel = graph.topics.filter((topic) => levels.has(topic.level));
  const visibleTopics = onLevel.filter((topic) =>
    expanded.has(topic.section_id),
  );
  const visible = new Set(visibleTopics.map((topic) => topic.id));
  const parents = overviewParents(graph, byId, visible);

  const nodes = new Map<string, MapTopicNode>(
    visibleTopics.map((topic) => [
      topic.id,
      { kind: "topic", id: topicNodeId(topic.id), topic, children: [] },
    ]),
  );
  const underSection = new Map<string, MapTopicNode[]>();
  // Темы обходятся в порядке маршрута, и дети у каждого узла получаются в нём же.
  for (const topic of visibleTopics) {
    const node = nodes.get(topic.id);
    if (!node) {
      continue;
    }
    const parentId = parents.get(topic.id);
    const parent = parentId === undefined ? undefined : nodes.get(parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      const siblings = underSection.get(topic.section_id) ?? [];
      siblings.push(node);
      underSection.set(topic.section_id, siblings);
    }
  }

  const sectionNodes: MapSectionNode[] = [];
  for (const section of sections) {
    const topicCount = onLevel.filter(
      (topic) => topic.section_id === section.id,
    ).length;
    if (topicCount === 0) {
      continue;
    }
    sectionNodes.push({
      kind: "section",
      id: sectionNodeId(section.id),
      section,
      topicCount,
      expanded: expanded.has(section.id),
      children: underSection.get(section.id) ?? [],
    });
  }

  const overviewLinks = graph.edges
    .filter(
      (edge) =>
        edge.kind === "member" &&
        visible.has(edge.source) &&
        visible.has(edge.target) &&
        parents.get(edge.target) !== edge.source,
    )
    .map((edge) => ({ overview: edge.source, topic: edge.target }));

  return { sections: sectionNodes, visible, overviewLinks };
}
