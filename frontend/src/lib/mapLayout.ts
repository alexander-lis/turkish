import { hierarchy, tree } from "d3-hierarchy";
import type { Section, TopicSummary } from "../api/types.ts";
import {
  ROOT_NODE_ID,
  type MapSectionNode,
  type MapTopicNode,
  type MapTree,
} from "./mapTree.ts";

/*
 * Раскладка карты тем: двустороннее дерево. Корень в центре, разделы расходятся вправо
 * и влево, темы идут строками. Координаты — центры узлов; одинаковый вход даёт
 * одинаковые координаты.
 */

export type Side = "left" | "right";

/** Ширина узла темы и раздела и высота узла темы: её название стоит в одну строку. */
export const NODE_WIDTH = 232;
export const NODE_HEIGHT = 36;
/** Узел раздела выше: название раздела занимает до трёх строк. */
export const SECTION_HEIGHT = 56;
/** Шаг между строками соседних узлов и между столбцами глубины дерева. */
const ROW_STEP = 44;
const COLUMN_STEP = NODE_WIDTH + 56;
/** Между ветками разных родителей — чуть больше места, чем между братьями. */
const COUSIN_SEPARATION = 1.4;
/** Соседние разделы стоят с тем же просветом, что и темы, хотя их узлы выше. */
const SECTION_SEPARATION = (SECTION_HEIGHT + ROW_STEP - NODE_HEIGHT) / ROW_STEP;

export type PlacedNode =
  | { kind: "root"; id: string; x: number; y: number }
  | {
      kind: "section";
      id: string;
      x: number;
      y: number;
      side: Side;
      node: MapSectionNode;
    }
  | {
      kind: "topic";
      id: string;
      x: number;
      y: number;
      side: Side;
      node: MapTopicNode;
    };

/** Ветка дерева: от родителя к ребёнку. */
interface Branch {
  source: string;
  target: string;
  side: Side;
}

export interface MapLayout {
  nodes: PlacedNode[];
  branches: Branch[];
}

/**
 * Стороны разделов. Делятся один раз, по полному числу тем: первые разделы — справа,
 * остальные — слева, граница там, где стороны ближе всего к равным. Сворачивание и фильтр
 * уровней сторону не меняют, потому что сюда они не входят.
 */
export function splitSections(
  topics: readonly TopicSummary[],
  sections: readonly Section[],
): Map<string, Side> {
  const counts = sections.map(
    (section) =>
      topics.filter((topic) => topic.section_id === section.id).length,
  );
  const total = counts.reduce((sum, count) => sum + count, 0);
  let boundary = sections.length;
  let bestGap = Infinity;
  let right = 0;
  counts.forEach((count, index) => {
    right += count;
    const gap = Math.abs(right - (total - right));
    if (gap < bestGap) {
      bestGap = gap;
      boundary = index + 1;
    }
  });
  return new Map(
    sections.map((section, index) => [
      section.id,
      index < boundary ? "right" : "left",
    ]),
  );
}

type Datum =
  { kind: "root"; sections: MapSectionNode[] } | MapSectionNode | MapTopicNode;

function children(datum: Datum): readonly Datum[] {
  return datum.kind === "root" ? datum.sections : datum.children;
}

function layoutSide(sections: MapSectionNode[], side: Side): MapLayout {
  const root = hierarchy<Datum>({ kind: "root", sections }, children);
  const placed = tree<Datum>()
    .nodeSize([ROW_STEP, COLUMN_STEP])
    .separation((a, b) => {
      if (a.data.kind === "section" && b.data.kind === "section") {
        return SECTION_SEPARATION;
      }
      return a.parent === b.parent ? 1 : COUSIN_SEPARATION;
    })(root);
  const sign = side === "right" ? 1 : -1;
  const nodes: PlacedNode[] = [];
  const branches: Branch[] = [];
  // У d3 дерево растёт вниз: глубина — по y, соседи — по x. Карте нужно вбок.
  for (const point of placed.descendants()) {
    const { data } = point;
    const x = sign * point.y;
    const y = point.x;
    if (data.kind === "section") {
      nodes.push({ kind: "section", id: data.id, x, y, side, node: data });
    } else if (data.kind === "topic") {
      nodes.push({ kind: "topic", id: data.id, x, y, side, node: data });
    }
    const parent = point.parent?.data;
    if (parent) {
      branches.push({
        source: parent.kind === "root" ? ROOT_NODE_ID : parent.id,
        target: data.kind === "root" ? ROOT_NODE_ID : data.id,
        side,
      });
    }
  }
  return { nodes, branches };
}

export function layoutMap(
  mapTree: MapTree,
  sides: ReadonlyMap<string, Side>,
): MapLayout {
  const sideOf = (section: MapSectionNode) =>
    sides.get(section.section.id) ?? "right";
  const right = layoutSide(
    mapTree.sections.filter((section) => sideOf(section) === "right"),
    "right",
  );
  const left = layoutSide(
    mapTree.sections.filter((section) => sideOf(section) === "left"),
    "left",
  );
  return {
    nodes: [
      { kind: "root", id: ROOT_NODE_ID, x: 0, y: 0 },
      ...right.nodes,
      ...left.nodes,
    ],
    branches: [...right.branches, ...left.branches],
  };
}
