import type { BlockKind } from "../api/types.ts";

/** Блок страницы темы: текстовый блок статьи, примеры или связанные темы. */
export type TemplateBlock = BlockKind | "examples" | "related";

/**
 * Шаблон статьи: порядок блоков на странице и их заголовки.
 *
 * Виды текстовых блоков приходят из описания API. Когда на сервере появится новый вид,
 * этот объект перестанет компилироваться, пока блоку не дадут место и заголовок.
 */
export const TEMPLATE = {
  formula: "Формула",
  forms: "Формы",
  examples: "Примеры",
  pitfalls: "Подводные камни",
  vs_russian: "Сравнение с русским",
  related: "Связанные темы",
} as const satisfies Record<TemplateBlock, string>;

export const TEMPLATE_ORDER = Object.keys(TEMPLATE) as TemplateBlock[];
