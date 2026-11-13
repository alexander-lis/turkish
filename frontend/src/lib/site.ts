export const SITE_TITLE = "Турецкая грамматика";

export function topicPath(id: string): string {
  return `/topics/${id}`;
}

export const NOTATION_PATH = "/notation";

/** Карта тем — главная страница. */
export const MAP_PATH = "/";

/** Карта тем с выбранной темой: её окно открыто. */
export function mapTopicPath(id: string): string {
  return `${MAP_PATH}?${new URLSearchParams({ topic: id }).toString()}`;
}
