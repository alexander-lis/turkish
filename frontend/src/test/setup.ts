import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";
import { server } from "./server.ts";

// Перехват запросов включается до загрузки модулей приложения:
// клиент API запоминает fetch в момент своего создания.
server.listen({ onUnhandledFrame: "error" });

// В jsdom нет прокрутки: панель навигации прокручивает к открытой теме.
Element.prototype.scrollIntoView = () => undefined;

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});
