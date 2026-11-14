/** Запросы графа тем и поискового индекса: интерфейс получает их так, как отдаёт сервер. */
import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { graph, searchIndex } from "../test/fixtures.ts";
import { graphQuery, searchIndexQuery } from "./queries.ts";

test("запрос графа возвращает темы, связи и различения", async () => {
  const client = new QueryClient();

  const result = await client.query(graphQuery);

  expect(result).toEqual(graph);
});

test("запрос поискового индекса возвращает записи обо всех темах", async () => {
  const client = new QueryClient();

  const result = await client.query(searchIndexQuery);

  expect(result).toEqual(searchIndex);
});
