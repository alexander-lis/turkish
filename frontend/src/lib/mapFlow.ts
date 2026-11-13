import { MarkerType, type Edge, type Node, type Viewport } from "@xyflow/react";
import type { TopicSummary } from "../api/types.ts";
import type { CrossLine } from "./mapLinks.ts";
import {
  NODE_HEIGHT,
  NODE_WIDTH,
  SECTION_HEIGHT,
  type MapLayout,
  type PlacedNode,
} from "./mapLayout.ts";
import { LINE_STYLES, type MapLineKind } from "./mapStyle.ts";
import { topicNodeId, type MapSectionNode } from "./mapTree.ts";

/*
 * Раскладка и линии карты тем в виде узлов и линий React Flow: размеры узлов, точки
 * крепления линий и их начертание; виден ли узел на холсте.
 */

const ROOT_WIDTH = 208;
const ROOT_HEIGHT = 48;

type RootFlowNode = Node<Record<string, never>, "root">;
export type SectionFlowNode = Node<{ section: MapSectionNode }, "section">;
export type TopicFlowNode = Node<
  { topic: TopicSummary; selected: boolean; dimmed: boolean },
  "topic"
>;
export type MapFlowNode = RootFlowNode | SectionFlowNode | TopicFlowNode;
/** Линия между узлами одного столбца: дуга, выгнутая наружу от столбца. */
export type ArcFlowEdge = Edge<Record<string, never>, "arc">;

/** Точки крепления линий у каждого узла: входящая и исходящая с обеих сторон. */
export const HANDLES = {
  leftIn: "left-in",
  leftOut: "left-out",
  rightIn: "right-in",
  rightOut: "right-out",
} as const;

export interface Highlight {
  /** Выбранная тема: её узел выделен. */
  selected: string | null;
  /** Тема, связи которой показаны: выбранная или та, на узел которой навели. */
  highlighted: string | null;
  /** Темы, связанные с ней: их узлы не приглушаются. */
  linked: ReadonlySet<string>;
}

function size(node: PlacedNode): { width: number; height: number } {
  if (node.kind === "root") {
    return { width: ROOT_WIDTH, height: ROOT_HEIGHT };
  }
  return {
    width: NODE_WIDTH,
    height: node.kind === "section" ? SECTION_HEIGHT : NODE_HEIGHT,
  };
}

/** Виден ли узел целиком на холсте такого размера при таком положении карты. */
export function nodeFitsCanvas(
  node: PlacedNode,
  viewport: Viewport,
  canvas: { width: number; height: number },
): boolean {
  const { width, height } = size(node);
  const left = (node.x - width / 2) * viewport.zoom + viewport.x;
  const top = (node.y - height / 2) * viewport.zoom + viewport.y;
  return (
    left >= 0 &&
    top >= 0 &&
    left + width * viewport.zoom <= canvas.width &&
    top + height * viewport.zoom <= canvas.height
  );
}

export function flowNodes(
  layout: MapLayout,
  { selected, highlighted, linked }: Highlight,
): MapFlowNode[] {
  return layout.nodes.map((placed): MapFlowNode => {
    const { width, height } = size(placed);
    const base = {
      id: placed.id,
      position: { x: placed.x - width / 2, y: placed.y - height / 2 },
      width,
      height,
    };
    if (placed.kind === "root") {
      return { ...base, type: "root", data: {} };
    }
    // Нажатия узлы обрабатывают сами, кнопкой внутри. Без своих обработчиков у узла
    // React Flow отключает ему события указателя, и до кнопки они бы не дошли.
    const interactive = { ...base, style: { pointerEvents: "all" as const } };
    if (placed.kind === "section") {
      return {
        ...interactive,
        type: "section",
        data: { section: placed.node },
      };
    }
    const { topic } = placed.node;
    return {
      ...interactive,
      type: "topic",
      data: {
        topic,
        selected: topic.id === selected,
        dimmed:
          highlighted !== null &&
          topic.id !== highlighted &&
          !linked.has(topic.id),
      },
    };
  });
}

function edgeStyle(
  kind: MapLineKind,
  emphasis: "branch" | "layer" | "selected",
) {
  const line = LINE_STYLES[kind];
  return {
    style: {
      stroke: line.stroke,
      strokeWidth: emphasis === "selected" ? 2.25 : 1.5,
      opacity: emphasis === "layer" ? 0.5 : 1,
      ...(line.dash === undefined ? {} : { strokeDasharray: line.dash }),
    },
    ...(line.arrow
      ? {
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: line.stroke,
            width: 16,
            height: 16,
          },
        }
      : {}),
  };
}

/** Насколько дуга уходит от столбца: тем дальше, чем дальше друг от друга её концы. */
const ARC_BEND = { share: 0.4, min: 28, max: 220 } as const;

/**
 * Путь SVG дуги между точками одной стороны столбца: `side` — 1, если дуга выгибается
 * вправо, −1 — влево. Дуги к дальним узлам выгнуты сильнее и не ложатся на ближние.
 */
export function arcPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  side: 1 | -1,
): string {
  const bend =
    side *
    Math.min(
      ARC_BEND.max,
      Math.max(ARC_BEND.min, Math.abs(target.y - source.y) * ARC_BEND.share),
    );
  return `M ${source.x},${source.y} C ${source.x + bend},${source.y} ${target.x + bend},${target.y} ${target.x},${target.y}`;
}

function sameColumn(source: PlacedNode, target: PlacedNode): boolean {
  return Math.abs(source.x - target.x) < 1;
}

/**
 * Точки крепления линии между двумя узлами: от стороны начала, обращённой к концу.
 * Узлы одного столбца соединяются по внешней стороне, чтобы линия не шла сквозь узлы.
 */
function handles(
  source: PlacedNode,
  target: PlacedNode,
): { sourceHandle: string; targetHandle: string } {
  if (sameColumn(source, target)) {
    return source.x >= 0
      ? { sourceHandle: HANDLES.rightOut, targetHandle: HANDLES.rightIn }
      : { sourceHandle: HANDLES.leftOut, targetHandle: HANDLES.leftIn };
  }
  return source.x < target.x
    ? { sourceHandle: HANDLES.rightOut, targetHandle: HANDLES.leftIn }
    : { sourceHandle: HANDLES.leftOut, targetHandle: HANDLES.rightIn };
}

/**
 * Линии React Flow: ветки дерева и перекрёстные линии. Ветки — оформление, программы чтения
 * с экрана их пропускают; перекрёстная линия названа видом связи и темами.
 */
export function flowEdges(
  layout: MapLayout,
  lines: CrossLine[],
  topics: ReadonlyMap<string, TopicSummary>,
): Edge[] {
  const title = (id: string) => topics.get(id)?.title ?? id;
  const placed = new Map(layout.nodes.map((node) => [node.id, node]));
  const edges: Edge[] = [];
  for (const branch of layout.branches) {
    const source = placed.get(branch.source);
    const target = placed.get(branch.target);
    if (source && target) {
      edges.push({
        id: `branch:${branch.source}:${branch.target}`,
        source: branch.source,
        target: branch.target,
        ...handles(source, target),
        ...edgeStyle("branch", "branch"),
        domAttributes: { "aria-hidden": true },
      });
    }
  }
  // Линии выбранной темы рисуются последними, поверх остальных.
  const ordered = [
    ...lines.filter((line) => !line.selected),
    ...lines.filter((line) => line.selected),
  ];
  for (const line of ordered) {
    const sourceId = topicNodeId(line.source);
    const targetId = topicNodeId(line.target);
    const source = placed.get(sourceId);
    const target = placed.get(targetId);
    if (source && target) {
      edges.push({
        id: line.id,
        source: sourceId,
        target: targetId,
        ...(sameColumn(source, target) ? { type: "arc" } : {}),
        ...handles(source, target),
        ...edgeStyle(line.kind, line.selected ? "selected" : "layer"),
        ariaLabel: `${LINE_STYLES[line.kind].name}: ${title(line.source)} — ${title(line.target)}`,
      });
    }
  }
  return edges;
}
