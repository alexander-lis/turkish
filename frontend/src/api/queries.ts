import { QueryClient, queryOptions } from "@tanstack/react-query";
import {
  fetchGraph,
  fetchNotation,
  fetchSearchIndex,
  fetchSections,
  fetchTopic,
  isNotFound,
} from "./client.ts";

/** Разделы в порядке, заданном в контенте. Темы карта тем берёт из графа. */
export const sectionsQuery = queryOptions({
  queryKey: ["sections"],
  queryFn: fetchSections,
});

export function topicQuery(id: string) {
  return queryOptions({
    queryKey: ["topic", id],
    queryFn: () => fetchTopic(id),
  });
}

/** Граф тем: все темы в порядке учебного маршрута, связи между ними и различения. */
export const graphQuery = queryOptions({
  queryKey: ["graph"],
  queryFn: fetchGraph,
});

/**
 * Поисковый индекс: все темы с текстом статей и примерами. Окно поиска включает запрос,
 * когда открыто; дальше индекс живёт в кеше до перезагрузки страницы.
 */
export const searchIndexQuery = queryOptions({
  queryKey: ["search-index"],
  queryFn: fetchSearchIndex,
});

export const notationQuery = queryOptions({
  queryKey: ["notation"],
  queryFn: fetchNotation,
});

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Контент меняется только при перезапуске сервера.
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        // «Не найдено» повторять бессмысленно, остальное — один раз.
        retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
      },
    },
  });
}
