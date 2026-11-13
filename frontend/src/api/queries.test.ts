/** Запрос графа тем: интерфейс получает граф так, как его отдаёт сервер. */
import { QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { graph } from "../test/fixtures.ts";
import { graphQuery } from "./queries.ts";

test("запрос графа возвращает темы, связи и различения", async () => {
  const client = new QueryClient();

  const result = await client.query(graphQuery);

  expect(result).toEqual(graph);
});
