/** Раскладка карты тем: двустороннее дерево с постоянной стороной у каждого раздела. */
import { describe, expect, test } from "vitest";
import type { Level, Section, TopicSummary } from "../api/types.ts";
import { graph, sections } from "../test/fixtures.ts";
import {
  layoutMap,
  NODE_HEIGHT,
  NODE_WIDTH,
  SECTION_HEIGHT,
  splitSections,
  type PlacedNode,
  type Side,
} from "./mapLayout.ts";
import { buildMapTree, sectionNodeId, topicNodeId } from "./mapTree.ts";

const ALL_LEVELS = new Set<Level>(["A1", "A2", "B1", "B2"]);
const ALL_SECTIONS = new Set(sections.map((section) => section.id));

function expandedTree(levels: ReadonlySet<Level> = ALL_LEVELS) {
  return buildMapTree(graph, sections, { levels, expanded: ALL_SECTIONS });
}

/** Узел раздела выше узла темы; корень стоит один и в сравнении не участвует. */
function height(node: PlacedNode): number {
  return node.kind === "section" ? SECTION_HEIGHT : NODE_HEIGHT;
}

function overlap(a: PlacedNode, b: PlacedNode): boolean {
  return (
    Math.abs(a.x - b.x) < NODE_WIDTH &&
    Math.abs(a.y - b.y) < (height(a) + height(b)) / 2
  );
}

function sideOfNode(node: PlacedNode): Side | null {
  return node.kind === "root" ? null : node.side;
}

function placed(nodes: PlacedNode[], id: string): PlacedNode {
  const node = nodes.find((candidate) => candidate.id === id);
  if (!node) throw new Error(`на карте нет узла ${id}`);
  return node;
}

describe("деление разделов между сторонами", () => {
  function topicsOf(counts: number[]): {
    topics: TopicSummary[];
    sections: Section[];
  } {
    const many = counts.map((_, index) => ({
      id: `s${index}`,
      title: `Раздел ${index}`,
    }));
    const topics = counts.flatMap((count, index) =>
      Array.from({ length: count }, (_, number) => ({
        id: `s${index}-t${number}`,
        title: `Тема ${number}`,
        level: "A1" as const,
        section_id: `s${index}`,
        summary: "",
        is_stub: true,
        is_overview: false,
      })),
    );
    return { topics, sections: many };
  }

  test("граница проходит там, где стороны ближе всего к равным", () => {
    const { topics, sections: many } = topicsOf([10, 5, 5, 8, 2]);

    expect([...splitSections(topics, many).values()]).toEqual([
      "right",
      "right",
      "left",
      "left",
      "left",
    ]);
  });

  test("единственный раздел стоит справа", () => {
    const { topics, sections: one } = topicsOf([4]);

    expect([...splitSections(topics, one).values()]).toEqual(["right"]);
  });

  test("тестовые разделы: существительное справа, остальное слева", () => {
    expect(Object.fromEntries(splitSections(graph.topics, sections))).toEqual({
      nouns: "right",
      phonetics: "left",
      verbs: "left",
    });
  });
});

describe("раскладка", () => {
  const sides = splitSections(graph.topics, sections);
  const layout = layoutMap(expandedTree(), sides);

  test("корень стоит в центре, разделы — по своим сторонам", () => {
    expect(placed(layout.nodes, "root")).toMatchObject({ x: 0, y: 0 });
    expect(placed(layout.nodes, sectionNodeId("nouns")).x).toBeGreaterThan(0);
    expect(placed(layout.nodes, sectionNodeId("verbs")).x).toBeLessThan(0);
  });

  test("у каждого узла, кроме корня, одна ветка к родителю", () => {
    const targets = layout.branches.map((branch) => branch.target);
    expect(targets).toHaveLength(layout.nodes.length - 1);
    expect(new Set(targets).size).toBe(targets.length);
    expect(targets).not.toContain("root");
  });

  test("ребёнок стоит дальше от корня, чем родитель", () => {
    for (const branch of layout.branches) {
      const parent = placed(layout.nodes, branch.source);
      const child = placed(layout.nodes, branch.target);
      expect(Math.abs(child.x)).toBeGreaterThan(Math.abs(parent.x));
    }
  });

  test("узлы одной стороны не перекрываются", () => {
    for (const side of ["left", "right"] as const) {
      const nodes = layout.nodes.filter((node) => sideOfNode(node) === side);
      nodes.forEach((a, index) => {
        for (const b of nodes.slice(index + 1)) {
          expect(overlap(a, b), `${a.id} и ${b.id}`).toBe(false);
        }
      });
    }
  });

  test("свёрнутые разделы не перекрываются: просвет между ними тот же, что между темами", () => {
    const oneSide = new Map(sections.map((s) => [s.id, "right" as const]));
    const collapsed = layoutMap(
      buildMapTree(graph, sections, {
        levels: ALL_LEVELS,
        expanded: new Set(),
      }),
      oneSide,
    )
      .nodes.filter((node) => node.kind === "section")
      .sort((a, b) => a.y - b.y);
    const topicGap =
      placed(layout.nodes, topicNodeId("locative-da")).y -
      placed(layout.nodes, topicNodeId("dative-a")).y -
      NODE_HEIGHT;

    expect(collapsed).toHaveLength(sections.length);
    expect(topicGap).toBeGreaterThan(0);
    collapsed.slice(1).forEach((node, index) => {
      const above = collapsed[index];
      if (!above) throw new Error("нет соседнего раздела");
      expect(node.y - above.y - SECTION_HEIGHT).toBeCloseTo(topicGap);
    });
  });

  test("повторный вызов даёт те же координаты", () => {
    expect(layoutMap(expandedTree(), sides)).toEqual(layout);
  });

  test("левая сторона зеркальна правой по горизонтали", () => {
    const allRight = new Map(sections.map((s) => [s.id, "right" as const]));
    const allLeft = new Map(sections.map((s) => [s.id, "left" as const]));
    const right = layoutMap(expandedTree(), allRight).nodes;
    const left = layoutMap(expandedTree(), allLeft).nodes;

    expect(left.map((node) => [node.id, -node.x || 0, node.y])).toEqual(
      right.map((node) => [node.id, node.x, node.y]),
    );
  });

  test("сторона раздела не меняется при сворачивании и при фильтре уровней", () => {
    const collapsed = layoutMap(
      buildMapTree(graph, sections, {
        levels: ALL_LEVELS,
        expanded: new Set(),
      }),
      sides,
    );
    const filtered = layoutMap(expandedTree(new Set(["A2", "B2"])), sides);

    for (const nodes of [collapsed.nodes, filtered.nodes]) {
      for (const node of nodes) {
        if (node.kind === "section") {
          expect(node.side).toBe(sides.get(node.node.section.id));
        }
      }
    }
    expect(placed(filtered.nodes, sectionNodeId("nouns")).x).toBeGreaterThan(0);
    expect(placed(filtered.nodes, sectionNodeId("verbs")).x).toBeLessThan(0);
  });
});
