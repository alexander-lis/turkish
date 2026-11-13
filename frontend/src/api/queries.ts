import { QueryClient, queryOptions } from "@tanstack/react-query";
import {
  fetchGraph,
  fetchNotation,
  fetchSections,
  fetchTopic,
  fetchTopics,
  isNotFound,
} from "./client.ts";
import type { Section, TopicSummary } from "./types.ts";

export interface TopicMap {
  /** Все темы в порядке учебного маршрута. */
  topics: TopicSummary[];
  /** Разделы в порядке, заданном в контенте. */
  sections: Section[];
}

/** Темы и разделы: одна загрузка на главную страницу и панель навигации. */
export const topicMapQuery = queryOptions({
  queryKey: ["topic-map"],
  queryFn: async (): Promise<TopicMap> => {
    const [topics, sections] = await Promise.all([
      fetchTopics(),
      fetchSections(),
    ]);
    return { topics, sections };
  },
});

export function topicQuery(id: string) {
  return queryOptions({
    queryKey: ["topic", id],
    queryFn: () => fetchTopic(id),
  });
}

/** Граф тем: все темы, связи между ними и различения. Нужен только карте тем. */
export const graphQuery = queryOptions({
  queryKey: ["graph"],
  queryFn: fetchGraph,
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
