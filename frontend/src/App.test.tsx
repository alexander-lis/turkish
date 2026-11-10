/** Требования «Неизвестный адрес» и «Состояния загрузки и ошибки». */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { topics } from "./test/fixtures.ts";
import { renderApp } from "./test/render.tsx";
import { server } from "./test/server.ts";

function main() {
  return within(screen.getByRole("main"));
}

test("неизвестный адрес показывает «Страница не найдена» и ссылку на главную", () => {
  renderApp("/no/such/page");

  expect(
    main().getByRole("heading", { name: "Страница не найдена" }),
  ).toBeInTheDocument();
  expect(main().getByRole("link", { name: "На главную" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("адрес несуществующей темы показывает «Страница не найдена» и ссылку на главную", async () => {
  renderApp("/topics/no-such-topic");

  expect(
    await main().findByRole("heading", { name: "Страница не найдена" }),
  ).toBeInTheDocument();
  expect(main().getByRole("link", { name: "На главную" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("пока данные загружаются, виден индикатор загрузки", async () => {
  server.use(
    http.get("*/api/topics", async () => {
      await delay(50);
      return HttpResponse.json(topics);
    }),
  );
  renderApp("/");

  expect(main().getByRole("status")).toHaveTextContent("Загрузка");
  expect(
    await main().findByRole("link", { name: "Гармония гласных" }),
  ).toBeInTheDocument();
  expect(main().queryByRole("status")).not.toBeInTheDocument();
});

test("при недоступном сервере видны сообщение об ошибке и кнопка повтора", async () => {
  server.use(http.get("*/api/topics", () => HttpResponse.error()));
  renderApp("/");

  const alert = await main().findByRole("alert");
  expect(alert).toHaveTextContent("Не удалось загрузить данные");
  expect(
    within(alert).getByRole("button", { name: "Повторить" }),
  ).toBeInTheDocument();
});

test("при ошибке сервера страница темы показывает сообщение об ошибке, а не пустой экран", async () => {
  server.use(
    http.get("*/api/topics/:id", () =>
      HttpResponse.json({ detail: "Сбой" }, { status: 500 }),
    ),
  );
  renderApp("/topics/locative-da");

  const alert = await main().findByRole("alert");
  expect(alert).toHaveTextContent("Не удалось загрузить данные");
  expect(
    main().queryByRole("heading", { name: "Страница не найдена" }),
  ).not.toBeInTheDocument();
});

test("после восстановления сервера кнопка повтора загружает данные", async () => {
  const user = userEvent.setup();
  server.use(http.get("*/api/topics", () => HttpResponse.error()));
  renderApp("/");
  const retry = await main().findByRole("button", { name: "Повторить" });

  server.resetHandlers();
  await user.click(retry);

  expect(
    await main().findByRole("link", { name: "Гармония гласных" }),
  ).toBeInTheDocument();
  expect(main().queryByRole("alert")).not.toBeInTheDocument();
});
