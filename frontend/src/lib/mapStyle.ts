import type { Level } from "../api/types.ts";
import type { LineKind } from "./mapLinks.ts";

/*
 * Оформление карты тем, общее для узлов, линий и условных обозначений: тон уровня
 * и начертание линии каждого вида. Виды линий различаются начертанием, а не только цветом.
 */

/** Цветная полоса уровня на узле темы. */
export const LEVEL_STRIPE = {
  A1: "bg-emerald-500",
  A2: "bg-sky-500",
  B1: "bg-violet-500",
  B2: "bg-amber-500",
} as const satisfies Record<Level, string>;

export type MapLineKind = LineKind | "branch";

export interface LineStyle {
  /** Вид связи: им линия названа для программ чтения с экрана. */
  name: string;
  /** Подпись в условных обозначениях. */
  label: string;
  stroke: string;
  /** Узор штриха SVG; без него линия сплошная. */
  dash?: string;
  /** Стрелка на конце линии: у пререквизита она смотрит на тему, которая его требует. */
  arrow: boolean;
}

export const LINE_STYLES: Record<MapLineKind, LineStyle> = {
  branch: {
    name: "Ветка дерева",
    label: "Ветка дерева",
    stroke: "#cbd5e1",
    arrow: false,
  },
  prerequisite: {
    name: "Пререквизит",
    label: "Пререквизит → тема, которой он нужен",
    stroke: "#475569",
    arrow: true,
  },
  contrast: {
    name: "Различение",
    label: "Различение",
    stroke: "#dc2626",
    dash: "7 4",
    arrow: false,
  },
  related: {
    name: "Связанная тема",
    label: "Связанная тема",
    stroke: "#0284c7",
    dash: "1 4",
    arrow: false,
  },
  overview: {
    name: "Тема обзора",
    label: "Тема обзора из другого раздела",
    stroke: "#7c3aed",
    dash: "14 5",
    arrow: false,
  },
};
