export const SITE_TITLE = "Турецкая грамматика";

export function topicPath(id: string): string {
  return `/topics/${id}`;
}

export const NOTATION_PATH = "/notation";

export const MAP_PATH = "/map";

/** Карта тем с выбранной темой. */
export function mapTopicPath(id: string): string {
  return `${MAP_PATH}?${new URLSearchParams({ topic: id }).toString()}`;
}
