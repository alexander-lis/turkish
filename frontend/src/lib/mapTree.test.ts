/**
 * Требования «Карта тем показывает все темы деревом», «Тема обзора стоит под обзором своего
 * раздела», «Порядок разделов и тем на карте» и «Фильтр уровней» — в части дерева.
 */
import { describe, expect, test } from "vitest";
import type { Level } from "../api/types.ts";
import { graph, sections } from "../test/fixtures.ts";
import { buildMapTree, type MapTopicNode, type MapTree } from "./mapTree.ts";

const ALL_LEVELS = new Set<Level>(["A1", "A2", "B1", "B2"]);
const ALL_SECTIONS = new Set(sections.map((section) => section.id));

/** Дерево в виде вложенных списков идентификаторов: так его легко сравнить целиком. */
type Outline = string | Record<string, Outline[]>;

function outline(node: MapTopicNode): Outline {
  return node.children.length === 0
    ? node.topic.id
    : { [node.topic.id]: node.children.map(outline) };
}

function sectionOutline(tree: MapTree): Record<string, Outline[]> {
  return Object.fromEntries(
    tree.sections.map((section) => [
      section.section.id,
      section.children.map(outline),
    ]),
  );
}

function allTopicIds(tree: MapTree): string[] {
  const ids: string[] = [];
  function walk(node: MapTopicNode) {
    ids.push(node.topic.id);
    node.children.forEach(walk);
  }
  tree.sections.forEach((section) => section.children.forEach(walk));
  return ids;
}

describe("развёрнутая карта", () => {
  const tree = buildMapTree(graph, sections, {
    levels: ALL_LEVELS,
    expanded: ALL_SECTIONS,
  });

  test("каждая тема стоит в дереве ровно один раз", () => {
    const ids = allTopicIds(tree);
    expect(ids).toHaveLength(graph.topics.length);
    expect(new Set(ids)).toEqual(
      new Set(graph.topics.map((topic) => topic.id)),
    );
    expect(tree.visible).toEqual(new Set(ids));
  });

  test("разделы идут в порядке контента и показывают число тем", () => {
    expect(
      tree.sections.map((section) => [section.section.id, section.topicCount]),
    ).toEqual([
      ["nouns", 5],
      ["phonetics", 1],
      ["verbs", 4],
    ]);
  });

  test("тема обзора стоит под обзором своего раздела, остальные — под разделом, всё в порядке маршрута", () => {
    expect(sectionOutline(tree)).toEqual({
      nouns: [
        "plural-lar",
        { "cases-overview": ["dative-a", "locative-da", "ablative-dan"] },
      ],
      phonetics: ["vowel-harmony"],
      verbs: [{ "tense-overview": ["past-di", "past-mis"] }, "passive-il"],
    });
  });

  test("тема из обзора другого раздела стоит под своим разделом и соединена с обзором линией", () => {
    expect(tree.overviewLinks).toEqual([
      { overview: "tense-overview", topic: "plural-lar" },
    ]);
  });
});

test("при свёрнутых разделах видны только разделы с числом тем", () => {
  const tree = buildMapTree(graph, sections, {
    levels: ALL_LEVELS,
    expanded: new Set(),
  });

  expect(tree.sections.map((section) => section.topicCount)).toEqual([5, 1, 4]);
  expect(tree.sections.every((section) => section.children.length === 0)).toBe(
    true,
  );
  expect(tree.visible.size).toBe(0);
  expect(tree.overviewLinks).toEqual([]);
});

test("развёрнут один раздел: линия к обзору свёрнутого раздела не нужна", () => {
  const tree = buildMapTree(graph, sections, {
    levels: ALL_LEVELS,
    expanded: new Set(["nouns"]),
  });

  expect(tree.sections.map((section) => section.expanded)).toEqual([
    true,
    false,
    false,
  ]);
  expect(tree.visible.has("plural-lar")).toBe(true);
  expect(tree.visible.has("tense-overview")).toBe(false);
  expect(tree.overviewLinks).toEqual([]);
});

describe("фильтр уровней", () => {
  test("оставлен один уровень: только его темы и разделы, где они есть", () => {
    const tree = buildMapTree(graph, sections, {
      levels: new Set(["A1"]),
      expanded: ALL_SECTIONS,
    });

    expect(sectionOutline(tree)).toEqual({
      nouns: ["plural-lar", { "cases-overview": ["dative-a", "locative-da"] }],
      phonetics: ["vowel-harmony"],
    });
    expect(tree.sections.map((section) => section.topicCount)).toEqual([4, 1]);
  });

  test("тема, обзор которой скрыт фильтром, стоит прямо под разделом", () => {
    const tree = buildMapTree(graph, sections, {
      levels: new Set(["A2", "B1", "B2"]),
      expanded: ALL_SECTIONS,
    });

    expect(sectionOutline(tree)).toEqual({
      nouns: ["ablative-dan"],
      verbs: [{ "tense-overview": ["past-di", "past-mis"] }, "passive-il"],
    });
    expect(tree.overviewLinks).toEqual([]);
  });
});

test("обзоры, входящие друг в друга по кругу, не теряют тем", () => {
  const looped = {
    ...graph,
    topics: graph.topics.map((topic) =>
      topic.id === "locative-da" ? { ...topic, is_overview: true } : topic,
    ),
    edges: [
      ...graph.edges,
      {
        kind: "member" as const,
        source: "locative-da",
        target: "cases-overview",
      },
    ],
  };

  const tree = buildMapTree(looped, sections, {
    levels: ALL_LEVELS,
    expanded: ALL_SECTIONS,
  });

  expect(allTopicIds(tree)).toHaveLength(graph.topics.length);
  expect(sectionOutline(tree)["nouns"]).toEqual([
    "plural-lar",
    { "cases-overview": ["dative-a", "locative-da", "ablative-dan"] },
  ]);
  expect(tree.overviewLinks).toContainEqual({
    overview: "locative-da",
    topic: "cases-overview",
  });
});
