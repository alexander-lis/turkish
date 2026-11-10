import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { notation, sections, topicDetails, topics } from "./fixtures.ts";

/** Сервер API для тестов: отдаёт тестовые данные так же, как настоящий. */
export const server = setupServer(
  http.get("*/api/topics", () => HttpResponse.json(topics)),
  http.get("*/api/sections", () => HttpResponse.json(sections)),
  http.get("*/api/topics/:id", ({ params }) => {
    const topic = topicDetails[String(params.id)];
    return topic
      ? HttpResponse.json(topic)
      : HttpResponse.json({ detail: "Тема не найдена" }, { status: 404 });
  }),
  http.get("*/api/notation", () => HttpResponse.json(notation)),
);
