import type { TemplateBlock } from "./template.ts";

export const SITE_TITLE = "Турецкая грамматика";

export function topicPath(id: string): string {
  return `/topics/${id}`;
}

/** Идентификатор заголовка блока темы; он же якорь в адресе, открытом на этом блоке. */
export function blockAnchor(block: TemplateBlock): string {
  return `block-${block}`;
}

export const NOTATION_PATH = "/notation";

/** Карта тем — главная страница. */
export const MAP_PATH = "/";

/** Карта тем с выбранной темой: её окно открыто. */
export function mapTopicPath(id: string): string {
  return `${MAP_PATH}?${new URLSearchParams({ topic: id }).toString()}`;
}

/** Карта тем с окном темы, открытым на блоке. */
export function mapTopicBlockPath(id: string, block: TemplateBlock): string {
  return `${mapTopicPath(id)}#${blockAnchor(block)}`;
}
