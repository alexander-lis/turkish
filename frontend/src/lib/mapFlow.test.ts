/**
 * Требования «Карта показывает связи выбранной темы» и «Положение карты сохраняется» —
 * в части приглушения узлов и того, виден ли узел на холсте.
 */
import { describe, expect, test } from "vitest";
import type { Level } from "../api/types.ts";
import { graph, sections } from "../test/fixtures.ts";
import { flowNodes, nodeFitsCanvas, type TopicFlowNode } from "./mapFlow.ts";
import { layoutMap, splitSections, type PlacedNode } from "./mapLayout.ts";
import { buildMapTree, topicNodeId } from "./mapTree.ts";

const layout = layoutMap(
  buildMapTree(graph, sections, {
    levels: new Set<Level>(["A1", "A2", "B1", "B2"]),
    expanded: new Set(sections.map((section) => section.id)),
  }),
  splitSections(graph.topics, sections),
);

function placed(topicId: string): PlacedNode {
  const node = layout.nodes.find(
    (candidate) => candidate.id === topicNodeId(topicId),
  );
  if (!node) throw new Error(`на карте нет темы ${topicId}`);
  return node;
}

describe("приглушение узлов", () => {
  function topicData(
    selected: string | null,
    highlighted: string | null,
  ): Map<string, TopicFlowNode["data"]> {
    const nodes = flowNodes(layout, {
      selected,
      highlighted,
      linked: new Set(["vowel-harmony"]),
    });
    return new Map(
      nodes.flatMap((node) =>
        node.type === "topic" ? [[node.data.topic.id, node.data]] : [],
      ),
    );
  }

  test("пока связи ничьи не показаны, ни один узел не приглушён и не выделен", () => {
    const data = [...topicData(null, null).values()];

    expect(data.every((node) => !node.dimmed && !node.selected)).toBe(true);
  });

  test("при наведении приглушены несвязанные темы, но ни один узел не выделен", () => {
    const data = topicData(null, "locative-da");

    expect(data.get("locative-da")).toMatchObject({
      dimmed: false,
      selected: false,
    });
    expect(data.get("vowel-harmony")?.dimmed).toBe(false);
    expect(data.get("past-mis")?.dimmed).toBe(true);
  });

  test("выбранная тема выделена", () => {
    const data = topicData("locative-da", "locative-da");

    expect(data.get("locative-da")).toMatchObject({
      dimmed: false,
      selected: true,
    });
    expect(data.get("vowel-harmony")?.selected).toBe(false);
  });
});

describe("узел на холсте", () => {
  const canvas = { width: 1200, height: 800 };
  const node = placed("locative-da");
  /** Положение карты, при котором центр узла стоит в этой точке холста. */
  const centeredAt = (x: number, y: number, zoom = 1) => ({
    x: x - node.x * zoom,
    y: y - node.y * zoom,
    zoom,
  });

  test("узел посередине холста виден", () => {
    expect(nodeFitsCanvas(node, centeredAt(600, 400), canvas)).toBe(true);
  });

  test.each([
    ["слева", -10, 400],
    ["справа", 1210, 400],
    ["сверху", 600, -10],
    ["снизу", 600, 810],
  ])("узел за краем холста (%s) не виден", (_, x, y) => {
    expect(nodeFitsCanvas(node, centeredAt(x, y), canvas)).toBe(false);
  });

  test("узел, обрезанный краем холста, не считается видимым", () => {
    expect(nodeFitsCanvas(node, centeredAt(100, 400), canvas)).toBe(false);
    expect(nodeFitsCanvas(node, centeredAt(120, 400), canvas)).toBe(true);
  });

  test("масштаб учитывается: уменьшенный узел у края помещается", () => {
    expect(nodeFitsCanvas(node, centeredAt(100, 400, 0.5), canvas)).toBe(true);
  });
});
