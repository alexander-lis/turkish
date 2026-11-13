/**
 * Требования «Карта показывает связи выбранной темы», «Слои связей», «Различение на карте»
 * и «Панель темы перечисляет связи по видам» — в части линий и списков связей.
 */
import { describe, expect, test } from "vitest";
import type { Level } from "../api/types.ts";
import { graph, sections } from "../test/fixtures.ts";
import {
  crossLines,
  linkedTopicIds,
  topicLinks,
  type CrossLine,
  type Layer,
  type TopicLinks,
} from "./mapLinks.ts";
import { buildMapTree } from "./mapTree.ts";

const ALL_LEVELS = new Set<Level>(["A1", "A2", "B1", "B2"]);
const ALL_SECTIONS = new Set(sections.map((section) => section.id));
const NO_LAYERS = new Set<Layer>();

const expanded = buildMapTree(graph, sections, {
  levels: ALL_LEVELS,
  expanded: ALL_SECTIONS,
});

function ids(lines: CrossLine[]): string[] {
  return lines.map((line) => line.id);
}

function titles(links: TopicLinks): Record<string, unknown> {
  const names = (topics: { id: string }[]) => topics.map((topic) => topic.id);
  return {
    prerequisites: names(links.prerequisites),
    requiredFor: names(links.requiredFor),
    overviews: names(links.overviews),
    members: names(links.members),
    contrasts: links.contrasts.map((contrast) => [
      contrast.title,
      names(contrast.topics),
    ]),
    related: names(links.related),
  };
}

describe("линии выбранной темы", () => {
  test("при выключенных слоях видны линии к обоим пререквизитам и к темам различения", () => {
    const lines = crossLines(graph, expanded, {
      layers: NO_LAYERS,
      selected: "locative-da",
    });

    expect(
      lines.filter((line) => line.selected).map((line) => line.id),
    ).toEqual([
      "prerequisite:vowel-harmony:locative-da",
      "prerequisite:plural-lar:locative-da",
      "contrast:dative-a:locative-da",
      "contrast:locative-da:ablative-dan",
    ]);
    expect(ids(lines)).not.toContain("contrast:dative-a:ablative-dan");
  });

  test("линии к теме, скрытой фильтром, нет, а в списке связей она есть", () => {
    const onlyA1 = buildMapTree(graph, sections, {
      levels: new Set(["A1"]),
      expanded: ALL_SECTIONS,
    });

    const lines = crossLines(graph, onlyA1, {
      layers: NO_LAYERS,
      selected: "locative-da",
    });

    expect(ids(lines)).not.toContain("contrast:locative-da:ablative-dan");
    expect(ids(lines)).toContain("contrast:dative-a:locative-da");
    expect(
      topicLinks(graph, "locative-da").contrasts[0]?.topics.map((t) => t.id),
    ).toContain("ablative-dan");
  });

  test("линии к теме свёрнутого раздела нет", () => {
    const nounsOnly = buildMapTree(graph, sections, {
      levels: ALL_LEVELS,
      expanded: new Set(["nouns"]),
    });

    const lines = crossLines(graph, nounsOnly, {
      layers: NO_LAYERS,
      selected: "plural-lar",
    });

    expect(ids(lines)).toEqual(["prerequisite:plural-lar:locative-da"]);
    expect(topicLinks(graph, "plural-lar").overviews.map((t) => t.id)).toEqual([
      "tense-overview",
    ]);
  });

  test("связь с обзором вне ветки видна всегда и отмечена у выбранной темы", () => {
    const lines = crossLines(graph, expanded, {
      layers: NO_LAYERS,
      selected: "plural-lar",
    });

    expect(lines).toContainEqual({
      id: "overview:tense-overview:plural-lar",
      kind: "overview",
      source: "tense-overview",
      target: "plural-lar",
      selected: true,
    });
    expect(
      crossLines(graph, expanded, { layers: NO_LAYERS, selected: null }),
    ).toEqual([
      expect.objectContaining({
        id: "overview:tense-overview:plural-lar",
        selected: false,
      }),
    ]);
  });
});

describe("слои", () => {
  test("слой «Различения»: различение трёх тем — три линии одного вида", () => {
    const lines = crossLines(graph, expanded, {
      layers: new Set(["contrasts"]),
      selected: null,
    });

    expect(
      lines.filter((line) => line.kind === "contrast").map((line) => line.id),
    ).toEqual([
      "contrast:dative-a:locative-da",
      "contrast:dative-a:ablative-dan",
      "contrast:locative-da:ablative-dan",
      "contrast:past-di:past-mis",
    ]);
  });

  test("слой «Пререквизиты»: линии идут от пререквизита к теме, которая его требует", () => {
    const lines = crossLines(graph, expanded, {
      layers: new Set(["prerequisites"]),
      selected: null,
    });

    const prerequisites = lines.filter((line) => line.kind === "prerequisite");
    expect(prerequisites).toHaveLength(
      graph.edges.filter((edge) => edge.kind === "prerequisite").length,
    );
    expect(prerequisites).toContainEqual(
      expect.objectContaining({ source: "vowel-harmony", target: "past-di" }),
    );
  });

  test("слой «Связанные темы»", () => {
    const lines = crossLines(graph, expanded, {
      layers: new Set(["related"]),
      selected: null,
    });

    expect(
      lines.filter((line) => line.kind === "related").map((line) => line.id),
    ).toEqual(["related:past-di:passive-il"]);
  });

  test("слой выключен и тема не выбрана — линий его вида нет", () => {
    const lines = crossLines(graph, expanded, {
      layers: NO_LAYERS,
      selected: null,
    });

    expect(lines.map((line) => line.kind)).toEqual(["overview"]);
  });
});

describe("связи темы для панели", () => {
  test("тема с пререквизитами, обзором и различением", () => {
    expect(titles(topicLinks(graph, "locative-da"))).toEqual({
      prerequisites: ["vowel-harmony", "plural-lar"],
      requiredFor: [],
      overviews: ["cases-overview"],
      members: [],
      contrasts: [["«Где», «куда» и «откуда»", ["dative-a", "ablative-dan"]]],
      related: [],
    });
  });

  test("тема, которая нужна другим, и связанная тема", () => {
    expect(titles(topicLinks(graph, "past-di"))).toEqual({
      prerequisites: ["vowel-harmony"],
      requiredFor: ["tense-overview"],
      overviews: ["tense-overview"],
      members: [],
      contrasts: [["-DI и -mIş", ["past-mis"]]],
      related: ["passive-il"],
    });
    expect(topicLinks(graph, "passive-il").related.map((t) => t.id)).toEqual([
      "past-di",
    ]);
  });

  test("темы обзора идут в порядке учебного маршрута", () => {
    expect(
      topicLinks(graph, "tense-overview").members.map((t) => t.id),
    ).toEqual(["plural-lar", "past-di", "past-mis"]);
  });

  test("связанные темы не приглушаются", () => {
    expect(linkedTopicIds(topicLinks(graph, "locative-da"))).toEqual(
      new Set([
        "vowel-harmony",
        "plural-lar",
        "cases-overview",
        "dative-a",
        "ablative-dan",
      ]),
    );
  });
});
