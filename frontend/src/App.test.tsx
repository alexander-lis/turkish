/**
 * Требования «Неизвестный адрес», «Состояния загрузки и ошибки», «Ссылка «Карта тем» в шапке»
 * и адреса карты из требования «Карта тем показывает все темы деревом».
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { topicDetails } from "./test/fixtures.ts";
import { currentLocation, renderApp } from "./test/render.tsx";
import { server } from "./test/server.ts";

const SLOW = { timeout: 5000 };

function main() {
  return within(screen.getByRole("main"));
}

/** Шапка страницы — первая: шапку статьи темы Testing Library тоже считает шапкой. */
function header() {
  const [banner] = screen.getAllByRole("banner");
  if (banner === undefined) throw new Error("на странице нет шапки");
  return within(banner);
}

function findMap() {
  return screen.findByRole("application", { name: "Карта тем" }, SLOW);
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
    http.get("*/api/topics/:id", async () => {
      await delay(50);
      return HttpResponse.json(topicDetails["vowel-harmony"]);
    }),
  );
  renderApp("/topics/vowel-harmony");

  expect(main().getByRole("status")).toHaveTextContent("Загрузка");
  expect(
    await main().findByRole("heading", { level: 1, name: "Гармония гласных" }),
  ).toBeInTheDocument();
  expect(main().queryByRole("status")).not.toBeInTheDocument();
});

test("при недоступном сервере видны сообщение об ошибке и кнопка повтора", async () => {
  server.use(http.get("*/api/graph", () => HttpResponse.error()));
  renderApp("/");

  const alert = await main().findByRole("alert", {}, SLOW);
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
  server.use(http.get("*/api/topics/:id", () => HttpResponse.error()));
  renderApp("/topics/vowel-harmony");
  const retry = await main().findByRole("button", { name: "Повторить" });

  server.resetHandlers();
  await user.click(retry);

  expect(
    await main().findByRole("heading", { level: 1, name: "Гармония гласных" }),
  ).toBeInTheDocument();
  expect(main().queryByRole("alert")).not.toBeInTheDocument();
});

describe("адреса карты тем", () => {
  test("по адресу / открывается карта тем", async () => {
    renderApp("/");

    expect(await findMap()).toBeInTheDocument();
  });

  test("старый адрес /map перенаправляет на / с той же темой", async () => {
    renderApp("/map?topic=locative-da");

    expect(await findMap()).toBeInTheDocument();
    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(
      await screen.findByRole("dialog", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
  });

  test("старый адрес /map без темы перенаправляет на /", async () => {
    renderApp("/map");

    expect(await findMap()).toBeInTheDocument();
    expect(currentLocation()).toBe("/");
  });
});

describe("ссылка «Карта тем» в шапке", () => {
  test("со страницы темы открывает карту с этой темой в окне темы", async () => {
    renderApp("/topics/locative-da");
    const link = header().getByRole("link", { name: "Карта тем" });
    expect(link).toHaveAttribute("href", "/?topic=locative-da");
    expect(link).not.toHaveAttribute("aria-current");

    await userEvent.click(link);

    expect(await findMap()).toBeInTheDocument();
    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(
      await screen.findByRole("dialog", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
  });

  test("со страницы обозначений открывает карту без окна темы", async () => {
    renderApp("/notation");

    await userEvent.click(header().getByRole("link", { name: "Карта тем" }));

    expect(await findMap()).toBeInTheDocument();
    expect(currentLocation()).toBe("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  test("на карте отмечена как текущая страница", async () => {
    renderApp("/");
    await findMap();

    expect(header().getByRole("link", { name: "Карта тем" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("название справочника в шапке ведёт туда же", () => {
    renderApp("/topics/locative-da");

    expect(
      header().getByRole("link", { name: "Турецкая грамматика" }),
    ).toHaveAttribute("href", "/?topic=locative-da");
  });

  test.each([
    ["/", () => findMap()],
    ["/topics/locative-da", () => main().findByRole("heading", { level: 1 })],
  ])(
    "на странице %s нет списка всех тем и кнопки, которая его открывает",
    async (route, loaded) => {
      renderApp(route);
      await loaded();

      expect(header().getAllByRole("link")).toHaveLength(2);
      // Единственная кнопка шапки открывает поиск, а не список тем.
      expect(header().getByRole("button")).toHaveAccessibleName("Поиск");
      expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
      // Навигация остаётся только внутри страницы: переходы по учебному маршруту.
      for (const navigation of screen.queryAllByRole("navigation")) {
        expect(screen.getByRole("main")).toContainElement(navigation);
      }
    },
  );
});
