/**
 * Страница «Карта тем»: связка дерева, раскладки и линий с холстом, панелью темы, адресом
 * и хранилищем. Логику дерева и линий проверяют тесты src/lib/map*.test.ts.
 */
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { describe, expect, test } from "vitest";
import { graph, topics } from "../test/fixtures.ts";
import { storeMapSettings } from "../lib/mapSettings.ts";
import { currentLocation, renderApp, type Scope } from "../test/render.tsx";
import { server } from "../test/server.ts";

const SLOW = { timeout: 5000 };

/** Открыть карту и дождаться холста с разделами. */
async function openMap(route = "/map"): Promise<Scope> {
  renderApp(route);
  const map = within(
    await screen.findByRole("application", { name: "Карта тем" }, SLOW),
  );
  await map.findAllByRole("button", { name: /, тем: \d+$/ }, SLOW);
  return map;
}

function sectionNode(map: Scope, title: string): HTMLElement {
  return map.getByRole("button", {
    name: (name) => name.startsWith(`${title}, тем:`),
  });
}

function topicNode(map: Scope, title: string): HTMLElement {
  return map.getByRole("button", {
    name: (name) => name.startsWith(`${title}, `),
  });
}

/** Названия тем на холсте: у узла темы, в отличие от узла раздела, есть aria-pressed. */
function topicNodeTitles(map: Scope): string[] {
  return map
    .queryAllByRole("button")
    .filter((button) => button.hasAttribute("aria-pressed"))
    .map((button) => button.getAttribute("title") ?? "");
}

function sectionNodeNames(map: Scope): string[] {
  return map
    .getAllByRole("button", { name: /, тем: \d+$/ })
    .map((button) => button.getAttribute("aria-label") ?? "");
}

/**
 * Нажать на узел или фон холста. Нажатие кнопкой мыши user-event начинает с mousedown без
 * окна в событии, а перемещение холста (d3-zoom) на mousedown обращается к окну и падает.
 * Поэтому здесь — одно событие click, как у нажатия с клавиатуры.
 */
function clickOnMap(element: Element): void {
  fireEvent.click(element);
}

async function expandAll(): Promise<void> {
  await userEvent.click(screen.getByRole("button", { name: "Развернуть все" }));
}

describe("дерево на холсте", () => {
  test("при первом открытии видны корень и разделы с числом тем, темы скрыты", async () => {
    const map = await openMap();

    expect(map.getByText("Турецкая грамматика")).toBeInTheDocument();
    expect(sectionNodeNames(map)).toEqual([
      "Существительное, тем: 5",
      "Фонетика и письмо, тем: 1",
      "Времена глагола, тем: 4",
    ]);
    expect(topicNodeTitles(map)).toEqual([]);
  });

  test("«Развернуть все» показывает каждую тему ровно один раз", async () => {
    const map = await openMap();

    await expandAll();

    const titles = topicNodeTitles(map);
    expect(titles).toHaveLength(topics.length);
    expect(new Set(titles)).toEqual(
      new Set(topics.map((topic) => topic.title)),
    );
  });

  test("заглушка и обзор помечены в имени узла", async () => {
    const map = await openMap();
    await expandAll();

    expect(topicNode(map, "Дательный падеж -(y)A")).toHaveAccessibleName(
      "Дательный падеж -(y)A, A1, не написано",
    );
    expect(topicNode(map, "Обзор падежей")).toHaveAccessibleName(
      "Обзор падежей, A1, обзор",
    );
    expect(topicNode(map, "Обзор времён")).toHaveAccessibleName(
      "Обзор времён, A2, обзор, не написано",
    );
    expect(topicNode(map, "Местный падеж -DA")).toHaveAccessibleName(
      "Местный падеж -DA, A1",
    );
  });

  test("если граф не загрузился, видны сообщение и кнопка повтора", async () => {
    server.use(http.get("*/api/graph", () => HttpResponse.error()));
    renderApp("/map");

    const alert = await screen.findByRole("alert", {}, SLOW);
    expect(alert).toHaveTextContent("Не удалось загрузить данные");

    server.use(http.get("*/api/graph", () => HttpResponse.json(graph)));
    await userEvent.click(
      within(alert).getByRole("button", { name: "Повторить" }),
    );
    expect(
      await screen.findByRole("application", { name: "Карта тем" }, SLOW),
    ).toBeInTheDocument();
  });

  test("у страницы заголовок вкладки «Карта тем»", async () => {
    await openMap();

    expect(document.title).toBe("Карта тем · Турецкая грамматика");
  });
});

function panel(): Scope {
  return within(screen.getByRole("complementary", { name: "Тема на карте" }));
}

function queryPanel(): HTMLElement | null {
  return screen.queryByRole("complementary", { name: "Тема на карте" });
}

/** Названия тем в списке панели под подписью. */
function panelList(label: string): string[] {
  return within(panel().getByRole("list", { name: label }))
    .getAllByRole("button")
    .map((button) => button.textContent.replace(/\s*не написано$/, ""));
}

function line(map: Scope, name: string): HTMLElement | null {
  return map.queryByRole("img", { name });
}

describe("выбор темы", () => {
  test("нажатие на узел выделяет тему, открывает панель и меняет адрес", async () => {
    const map = await openMap();
    clickOnMap(sectionNode(map, "Существительное"));

    clickOnMap(topicNode(map, "Местный падеж -DA"));

    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const info = panel();
    expect(
      info.getByRole("heading", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
    expect(info.getByText("A1")).toBeInTheDocument();
    expect(info.getByText("Существительное")).toBeInTheDocument();
    expect(
      info.getByText("Показывает, где что-то находится."),
    ).toBeInTheDocument();
    expect(
      info.getByRole("link", { name: /Открыть страницу темы/ }),
    ).toHaveAttribute("href", "/topics/locative-da");
    expect(currentLocation()).toBe("/map?topic=locative-da");
  });

  test("нажатие на пустое место карты снимает выбор и закрывает панель", async () => {
    const map = await openMap("/map?topic=locative-da");
    await screen.findByRole("complementary", { name: "Тема на карте" });

    const pane = document.querySelector(".react-flow__pane");
    if (!(pane instanceof HTMLElement)) throw new Error("на холсте нет фона");
    clickOnMap(pane);

    expect(queryPanel()).not.toBeInTheDocument();
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(currentLocation()).toBe("/map");
  });

  test("кнопка «Закрыть» снимает выбор", async () => {
    await openMap("/map?topic=locative-da");

    await userEvent.click(panel().getByRole("button", { name: "Закрыть" }));

    expect(queryPanel()).not.toBeInTheDocument();
    expect(currentLocation()).toBe("/map");
  });

  test("связи выбранной темы нарисованы линиями, несвязанные темы приглушены", async () => {
    storeMapSettings({
      levels: new Set(["A1", "A2", "B1", "B2"]),
      layers: new Set(),
      expanded: new Set(["nouns", "phonetics", "verbs"]),
    });
    const map = await openMap("/map?topic=locative-da");

    expect(
      line(map, "Пререквизит: Гармония гласных — Местный падеж -DA"),
    ).toBeInTheDocument();
    expect(
      line(map, "Пререквизит: Множественное число -lAr — Местный падеж -DA"),
    ).toBeInTheDocument();
    expect(
      line(map, "Различение: Местный падеж -DA — Исходный падеж -DAn"),
    ).toBeInTheDocument();
    expect(
      line(map, "Различение: Дательный падеж -(y)A — Исходный падеж -DAn"),
    ).not.toBeInTheDocument();
    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "true",
    );
    expect(topicNode(map, "Гармония гласных")).toHaveAttribute(
      "data-dimmed",
      "false",
    );
  });
});

describe("панель темы", () => {
  test("перечисляет связи по видам, пустых списков нет", async () => {
    await openMap("/map?topic=locative-da");

    expect(panelList("Пререквизиты")).toEqual([
      "Гармония гласных",
      "Множественное число -lAr",
    ]);
    expect(panelList("Входит в обзор")).toEqual(["Обзор падежей"]);
    const contrasts = within(panel().getByRole("list", { name: "Не путать" }));
    expect(contrasts.getByText("«Где», «куда» и «откуда»")).toBeInTheDocument();
    expect(
      contrasts
        .getAllByRole("button")
        .map((button) => button.textContent.replace(/\s*не написано$/, "")),
    ).toEqual(["Дательный падеж -(y)A", "Исходный падеж -DAn"]);
    for (const absent of ["Нужна для", "Темы обзора", "Связанные темы"]) {
      expect(panel().queryByText(absent)).not.toBeInTheDocument();
    }
  });

  test("у темы со связанной темой есть список «Связанные темы»", async () => {
    await openMap("/map?topic=past-di");

    expect(panelList("Связанные темы")).toEqual(["Страдательный залог -Il"]);
    expect(panelList("Нужна для")).toEqual(["Обзор времён"]);
  });

  test("нажатие на тему в панели выбирает её и раскрывает её раздел", async () => {
    const map = await openMap("/map?topic=locative-da");
    expect(sectionNode(map, "Фонетика и письмо")).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    await userEvent.click(
      within(panel().getByRole("list", { name: "Пререквизиты" })).getByRole(
        "button",
        { name: "Гармония гласных" },
      ),
    );

    expect(
      panel().getByRole("heading", { name: "Гармония гласных" }),
    ).toBeInTheDocument();
    expect(sectionNode(map, "Фонетика и письмо")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(topicNode(map, "Гармония гласных")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(currentLocation()).toBe("/map?topic=vowel-harmony");
  });
});

describe("адрес выбранной темы", () => {
  test("открытие адреса темы разворачивает её раздел и выбирает её", async () => {
    const map = await openMap("/map?topic=locative-da");

    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      panel().getByRole("heading", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
  });

  test("тема выключенного уровня: уровень включается, тема выбрана", async () => {
    storeMapSettings({
      levels: new Set(["A1", "A2", "B1"]),
      layers: new Set(["contrasts"]),
      expanded: new Set(),
    });

    const map = await openMap("/map?topic=ablative-dan");

    expect(screen.getByRole("button", { name: "B2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(topicNode(map, "Исходный падеж -DAn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("несуществующая тема в адресе: карта без выбора и без ошибки", async () => {
    const map = await openMap("/map?topic=no-such-topic");

    expect(queryPanel()).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(sectionNodeNames(map)).toHaveLength(3);
  });
});

function toolbarButton(name: string): HTMLElement {
  return screen.getByRole("button", { name });
}

describe("слои связей", () => {
  test("при первом открытии включён только слой «Различения»", async () => {
    await openMap();

    const layers = within(screen.getByRole("group", { name: "Слои связей" }));
    expect(
      layers
        .getAllByRole("button", { pressed: true })
        .map((button) => button.textContent),
    ).toEqual(["Различения"]);
  });

  test("слои включают и выключают линии своего вида на всей карте", async () => {
    const map = await openMap();
    await expandAll();

    expect(
      line(map, "Различение: Дательный падеж -(y)A — Исходный падеж -DAn"),
    ).toBeInTheDocument();
    expect(
      line(map, "Пререквизит: Гармония гласных — Прошедшее время -DI"),
    ).not.toBeInTheDocument();

    await userEvent.click(toolbarButton("Пререквизиты"));
    await userEvent.click(toolbarButton("Различения"));

    expect(
      line(map, "Пререквизит: Гармония гласных — Прошедшее время -DI"),
    ).toBeInTheDocument();
    expect(
      line(map, "Различение: Дательный падеж -(y)A — Исходный падеж -DAn"),
    ).not.toBeInTheDocument();
  });
});

describe("фильтр уровней", () => {
  test("оставлен один уровень: только его темы и разделы, где они есть", async () => {
    const map = await openMap();
    await expandAll();

    for (const level of ["A2", "B1", "B2"]) {
      await userEvent.click(toolbarButton(level));
    }

    expect(sectionNodeNames(map)).toEqual([
      "Существительное, тем: 4",
      "Фонетика и письмо, тем: 1",
    ]);
    expect(topicNodeTitles(map)).toEqual([
      "Множественное число -lAr",
      "Обзор падежей",
      "Дательный падеж -(y)A",
      "Местный падеж -DA",
      "Гармония гласных",
    ]);
  });

  test("последний включённый уровень не выключается", async () => {
    await openMap();
    for (const level of ["A2", "B1", "B2"]) {
      await userEvent.click(toolbarButton(level));
    }

    await userEvent.click(toolbarButton("A1"));

    expect(toolbarButton("A1")).toHaveAttribute("aria-pressed", "true");
  });

  test("уровень выбранной темы выключен — выбор снят", async () => {
    await openMap("/map?topic=past-di");

    await userEvent.click(toolbarButton("A2"));

    expect(queryPanel()).not.toBeInTheDocument();
    expect(currentLocation()).toBe("/map");
  });
});

describe("сворачивание разделов", () => {
  test("нажатие на раздел разворачивает и сворачивает его темы", async () => {
    const map = await openMap();
    const nouns = sectionNode(map, "Существительное");

    clickOnMap(nouns);
    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(topicNodeTitles(map)).toEqual([
      "Множественное число -lAr",
      "Обзор падежей",
      "Дательный падеж -(y)A",
      "Местный падеж -DA",
      "Исходный падеж -DAn",
    ]);

    clickOnMap(sectionNode(map, "Существительное"));
    expect(topicNodeTitles(map)).toEqual([]);
  });

  test("свёрнут раздел выбранной темы — выбор снят, панель закрыта", async () => {
    const map = await openMap("/map?topic=locative-da");

    clickOnMap(sectionNode(map, "Существительное"));

    expect(queryPanel()).not.toBeInTheDocument();
    expect(currentLocation()).toBe("/map");
    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  test("«Развернуть все» и «Свернуть все»", async () => {
    const map = await openMap();

    await expandAll();
    expect(topicNodeTitles(map)).toHaveLength(topics.length);

    await userEvent.click(toolbarButton("Свернуть все"));
    expect(topicNodeTitles(map)).toEqual([]);
    expect(toolbarButton("Развернуть все")).toBeInTheDocument();
  });
});

test("настройки вида сохраняются после перезагрузки страницы", async () => {
  const firstVisit = renderApp("/map");
  const map = within(
    await screen.findByRole("application", { name: "Карта тем" }, SLOW),
  );
  await map.findAllByRole("button", { name: /, тем: \d+$/ }, SLOW);
  clickOnMap(sectionNode(map, "Существительное"));
  clickOnMap(sectionNode(map, "Времена глагола"));
  await userEvent.click(toolbarButton("B2"));
  await userEvent.click(toolbarButton("Пререквизиты"));
  firstVisit.unmount();

  const reloaded = await openMap();

  expect(
    reloaded
      .getAllByRole("button", { expanded: true })
      .map((button) => button.getAttribute("title")),
  ).toEqual(["Существительное", "Времена глагола"]);
  expect(toolbarButton("B2")).toHaveAttribute("aria-pressed", "false");
  expect(toolbarButton("Пререквизиты")).toHaveAttribute("aria-pressed", "true");
});

test("условные обозначения показывают узлы, уровни и линии с подписями", async () => {
  await openMap();

  await userEvent.click(toolbarButton("Условные обозначения"));

  const legend = within(
    screen.getByRole("region", { name: "Условные обозначения" }),
  );
  for (const label of [
    "Не написано",
    "Обзор",
    "A1",
    "A2",
    "B1",
    "B2",
    "Пререквизит → тема, которой он нужен",
    "Различение",
    "Связанная тема",
    "Тема обзора из другого раздела",
  ]) {
    expect(legend.getByText(label)).toBeInTheDocument();
  }
});

describe("управление с клавиатуры", () => {
  test("узлы получают фокус клавишей Tab, у обёрток узлов своей остановки нет", async () => {
    const map = await openMap();

    const nouns = sectionNode(map, "Существительное");
    nouns.focus();
    await userEvent.tab();

    expect(sectionNode(map, "Фонетика и письмо")).toHaveFocus();
    expect(document.querySelector(".react-flow__node[tabindex]")).toBeNull();
  });

  test("Enter на узле раздела разворачивает его, Enter на узле темы выбирает её", async () => {
    const map = await openMap();

    sectionNode(map, "Существительное").focus();
    await userEvent.keyboard("{Enter}");
    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    topicNode(map, "Местный падеж -DA").focus();
    await userEvent.keyboard("{Enter}");
    expect(
      panel().getByRole("heading", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
    expect(currentLocation()).toBe("/map?topic=locative-da");
  });

  test("Escape снимает выбор и закрывает панель", async () => {
    await openMap("/map?topic=locative-da");

    await userEvent.keyboard("{Escape}");

    expect(queryPanel()).not.toBeInTheDocument();
    expect(currentLocation()).toBe("/map");
  });
});
