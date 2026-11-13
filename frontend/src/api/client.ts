import createClient from "openapi-fetch";
import type { paths } from "./schema";
import type {
  Notation,
  Section,
  TopicDetail,
  TopicGraph,
  TopicSummary,
} from "./types.ts";

/** Сервер ответил, но не данными: например, темы с таким идентификатором нет. */
class ApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Сервер ответил ошибкой ${status}`);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

// API живёт на том же адресе, с которого открыта страница.
const client = createClient<paths>({ baseUrl: window.location.origin });

function unwrap<T>(result: { data?: T; response: Response }): T {
  if (result.data === undefined) {
    throw new ApiError(result.response.status);
  }
  return result.data;
}

export async function fetchTopics(): Promise<TopicSummary[]> {
  return unwrap(await client.GET("/api/topics"));
}

export async function fetchSections(): Promise<Section[]> {
  return unwrap(await client.GET("/api/sections"));
}

export async function fetchTopic(id: string): Promise<TopicDetail> {
  return unwrap(
    await client.GET("/api/topics/{id}", { params: { path: { id } } }),
  );
}

export async function fetchGraph(): Promise<TopicGraph> {
  return unwrap(await client.GET("/api/graph"));
}

export async function fetchNotation(): Promise<Notation> {
  return unwrap(await client.GET("/api/notation"));
}
