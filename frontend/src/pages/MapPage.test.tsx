/**
 * Страница «Карта тем»: связка дерева, раскладки и линий с холстом, окном темы, адресом
 * и хранилищем. Логику дерева и линий проверяют тесты src/lib/map*.test.ts.
 */
import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, describe, expect, test, vi } from "vitest";
import { graph, topics } from "../test/fixtures.ts";
import {
  loadViewport,
  storeMapSettings,
  storeViewport,
} from "../lib/mapSettings.ts";
import {
  currentLocation,
  goBack,
  goTo,
  renderApp,
  type Scope,
} from "../test/render.tsx";
import { server } from "../test/server.ts";

const SLOW = { timeout: 5000 };

/** Открыть карту и дождаться холста с разделами. */
async function openMap(route = "/"): Promise<Scope> {
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
    renderApp("/");

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

function dialogElement(): HTMLDialogElement {
  const dialog = screen.getByRole("dialog");
  if (!(dialog instanceof HTMLDialogElement))
    throw new Error("окно — не <dialog>");
  return dialog;
}

/** Открытое окно темы. */
function topicDialog(): Scope {
  return within(dialogElement());
}

function queryDialog(): HTMLElement | null {
  return screen.queryByRole("dialog");
}

/** Окно темы, в котором статья уже загружена. */
async function loadedDialog(title: string): Promise<Scope> {
  const dialog = topicDialog();
  await dialog.findByRole("heading", { level: 1, name: title });
  return dialog;
}

function line(map: Scope, name: string): HTMLElement | null {
  return map.queryByRole("img", { name });
}

describe("выбор темы", () => {
  test("нажатие на узел выделяет тему, открывает окно темы и меняет адрес", async () => {
    const map = await openMap();
    clickOnMap(sectionNode(map, "Существительное"));

    clickOnMap(topicNode(map, "Местный падеж -DA"));

    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(
      screen.getByRole("dialog", { name: "Местный падеж -DA" }),
    ).toBeInTheDocument();
    const dialog = await loadedDialog("Местный падеж -DA");
    expect(dialog.getByText("A1")).toBeInTheDocument();
    expect(dialog.getByText("Существительное")).toBeInTheDocument();
    expect(
      dialog.getByText("Показывает, где что-то находится."),
    ).toBeInTheDocument();
    expect(
      dialog
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Формула",
      "Формы",
      "Примеры",
      "Подводные камни",
      "Сравнение с русским",
      "Не путать",
      "Связанные темы",
    ]);
    expect(
      dialog.getByRole("navigation", { name: "Учебный маршрут" }),
    ).toBeInTheDocument();
    expect(
      dialog.getByRole("link", { name: "Развернуть" }),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
  });

  test("окно заглушки показывает суть и сообщение «Статья ещё не написана»", async () => {
    const map = await openMap();
    clickOnMap(sectionNode(map, "Существительное"));

    clickOnMap(topicNode(map, "Дательный падеж -(y)A"));

    const dialog = await loadedDialog("Дательный падеж -(y)A");
    expect(
      dialog.getByText("Показывает, куда направлено движение."),
    ).toBeInTheDocument();
    expect(dialog.getByText("Статья ещё не написана.")).toBeInTheDocument();
  });

  test("окно показывает список «Нужна для»: темы, которым выбранная нужна как пререквизит", async () => {
    await openMap("/?topic=vowel-harmony");
    const dialog = await loadedDialog("Гармония гласных");

    const requiredFor = within(dialog.getByRole("list", { name: "Нужна для" }));
    expect(
      requiredFor
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Множественное число -lAr", "/?topic=plural-lar"],
      ["Обзор падежей", "/?topic=cases-overview"],
      ["Местный падеж -DA", "/?topic=locative-da"],
      ["Прошедшее время -DI", "/?topic=past-di"],
    ]);
    expect(dialog.queryByText("Пререквизиты")).not.toBeInTheDocument();
  });

  test("у темы, которая не нужна другим, списка «Нужна для» в окне нет", async () => {
    await openMap("/?topic=locative-da");
    const dialog = await loadedDialog("Местный падеж -DA");

    expect(dialog.getByText("Пререквизиты")).toBeInTheDocument();
    expect(dialog.queryByText("Нужна для")).not.toBeInTheDocument();
  });

  test("связи выбранной темы нарисованы линиями, несвязанные темы приглушены", async () => {
    storeMapSettings({
      levels: new Set(["A1", "A2", "B1", "B2"]),
      layers: new Set(),
      expanded: new Set(["nouns", "phonetics", "verbs"]),
    });
    const map = await openMap("/?topic=locative-da");

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

describe("подсветка связей", () => {
  const PREREQUISITE = "Пререквизит: Гармония гласных — Местный падеж -DA";

  /** Все разделы развёрнуты, все слои выключены: линий, кроме подсветки, нет. */
  async function openExpandedMap(): Promise<Scope> {
    storeMapSettings({
      levels: new Set(["A1", "A2", "B1", "B2"]),
      layers: new Set(),
      expanded: new Set(["nouns", "phonetics", "verbs"]),
    });
    return openMap();
  }

  test("наведение указателя показывает связи темы и приглушает несвязанные, уход — снимает", async () => {
    const map = await openExpandedMap();
    const node = topicNode(map, "Местный падеж -DA");
    expect(line(map, PREREQUISITE)).not.toBeInTheDocument();

    await userEvent.hover(node);

    expect(line(map, PREREQUISITE)).toBeInTheDocument();
    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "true",
    );
    expect(topicNode(map, "Гармония гласных")).toHaveAttribute(
      "data-dimmed",
      "false",
    );
    expect(node).toHaveAttribute("aria-pressed", "false");
    expect(queryDialog()).not.toBeInTheDocument();

    await userEvent.unhover(node);

    expect(line(map, PREREQUISITE)).not.toBeInTheDocument();
    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "false",
    );
  });

  test("фокус клавиатуры на узле показывает связи темы, уход фокуса — снимает", async () => {
    const map = await openExpandedMap();

    act(() => {
      topicNode(map, "Местный падеж -DA").focus();
    });
    expect(line(map, PREREQUISITE)).toBeInTheDocument();
    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "true",
    );

    await userEvent.tab();
    expect(line(map, PREREQUISITE)).not.toBeInTheDocument();
  });

  test("касание узла подсветку не включает", async () => {
    const map = await openExpandedMap();

    fireEvent.pointerEnter(topicNode(map, "Местный падеж -DA"), {
      pointerType: "touch",
    });

    expect(line(map, PREREQUISITE)).not.toBeInTheDocument();
  });

  test("узел под указателем скрыт вместе с разделом — подсветка снята", async () => {
    const map = await openExpandedMap();
    await userEvent.hover(topicNode(map, "Гармония гласных"));
    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "true",
    );

    clickOnMap(sectionNode(map, "Фонетика и письмо"));

    expect(topicNode(map, "Прошедшее время -mIş")).toHaveAttribute(
      "data-dimmed",
      "false",
    );
  });
});

describe("положение карты", () => {
  /** Сдвиг и масштаб, с которыми сейчас нарисован холст. */
  function canvasViewport(): { x: number; y: number; zoom: number } {
    const viewport = document.querySelector(".react-flow__viewport");
    if (!(viewport instanceof HTMLElement)) throw new Error("холста нет");
    const [x, y, zoom] = [
      ...viewport.style.transform.matchAll(/-?\d+(?:\.\d+)?/g),
    ].map(Number);
    if (x === undefined || y === undefined || zoom === undefined) {
      throw new Error(`непонятное положение: ${viewport.style.transform}`);
    }
    return { x, y, zoom };
  }

  test("сохранённое положение применяется к холсту", async () => {
    storeViewport({ x: -120, y: 80, zoom: 0.75 });

    await openMap();

    expect(canvasViewport()).toEqual({ x: -120, y: 80, zoom: 0.75 });
  });

  test("после изменения масштаба положение записывается и переживает перезагрузку", async () => {
    storeViewport({ x: -120, y: 80, zoom: 0.75 });
    const firstVisit = renderApp("/");
    await screen.findByRole("application", { name: "Карта тем" }, SLOW);

    await userEvent.click(screen.getByRole("button", { name: "Увеличить" }));

    await waitFor(() => {
      expect(loadViewport()?.zoom).toBeGreaterThan(0.75);
    });
    const stored = loadViewport();
    firstVisit.unmount();

    await openMap();
    // Холст округляет масштаб в стиле, поэтому сравнение — с точностью до округления.
    const reopened = canvasViewport();
    expect(reopened.x).toBeCloseTo(stored?.x ?? NaN);
    expect(reopened.y).toBeCloseTo(stored?.y ?? NaN);
    expect(reopened.zoom).toBeCloseTo(stored?.zoom ?? NaN);
  });

  test("испорченное положение в хранилище не мешает открыть карту", async () => {
    localStorage.setItem("topic-map-viewport", "{x:");

    const map = await openMap();

    expect(sectionNodeNames(map)).toHaveLength(3);
  });
});

describe("закрытие окна темы", () => {
  test("кнопка «Закрыть» закрывает окно и снимает выбор", async () => {
    const map = await openMap("/?topic=locative-da");

    await userEvent.click(
      topicDialog().getByRole("button", { name: "Закрыть" }),
    );

    expect(queryDialog()).not.toBeInTheDocument();
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(currentLocation()).toBe("/");
  });

  test("нажатие на затемнение вокруг окна закрывает его", async () => {
    await openMap("/?topic=locative-da");

    // Содержимое занимает всю площадь окна: сам <dialog> под указателем — это затемнение.
    await userEvent.click(dialogElement());

    expect(queryDialog()).not.toBeInTheDocument();
    expect(currentLocation()).toBe("/");
  });

  test("нажатие внутри окна и выделение, отпущенное за его краем, окно не закрывают", async () => {
    await openMap("/?topic=locative-da");
    const dialog = await loadedDialog("Местный падеж -DA");
    const title = dialog.getByRole("heading", { level: 1 });

    await userEvent.click(title);
    fireEvent.mouseDown(title);
    fireEvent.click(dialogElement());

    expect(queryDialog()).toBeInTheDocument();
    expect(currentLocation()).toBe("/?topic=locative-da");
  });

  test("второе нажатие двойного щелчка окно не закрывает", async () => {
    await openMap("/?topic=locative-da");

    fireEvent.mouseDown(dialogElement(), { detail: 2 });
    fireEvent.click(dialogElement(), { detail: 2 });

    expect(queryDialog()).toBeInTheDocument();
  });

  test("окно, закрытое браузером по Escape, снимает выбор темы", async () => {
    const map = await openMap("/?topic=locative-da");

    // Escape обрабатывает браузер: он закрывает окно и посылает событие close.
    const dialog = dialogElement();
    act(() => {
      dialog.close();
    });

    expect(queryDialog()).not.toBeInTheDocument();
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(currentLocation()).toBe("/");
  });
  test("тема, выбранная снова сразу после Escape, открывает окно", async () => {
    const map = await openMap("/?topic=locative-da");
    const dialog = dialogElement();

    // Браузер закрыл окно, а читатель тут же нажал Enter на узле, куда вернулся фокус:
    // оба перехода по адресу приходят раньше, чем страница успевает их отрисовать.
    act(() => {
      dialog.close();
      clickOnMap(topicNode(map, "Местный падеж -DA"));
    });

    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(await loadedDialog("Местный падеж -DA")).toBeDefined();
  });
});

describe("окно темы открывается на блоке из адреса", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("адрес с блоком: когда тема загрузилась, окно прокручено к заголовку блока", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    await openMap("/?topic=locative-da#block-pitfalls");
    const dialog = await loadedDialog("Местный падеж -DA");

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      dialog.getByRole("heading", { level: 2, name: "Подводные камни" }),
    );
  });

  test("тема из кеша: к блоку окно прокручивается уже открытым", async () => {
    await openMap("/?topic=locative-da");
    await loadedDialog("Местный падеж -DA");
    await userEvent.click(
      topicDialog().getByRole("button", { name: "Закрыть" }),
    );
    expect(queryDialog()).not.toBeInTheDocument();
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    goTo("/?topic=locative-da#block-examples");

    // Статья отрисована раньше, чем окно открылось: в закрытом окне прокрутка ничего
    // не даёт, поэтому последняя прокрутка обязана идти после открытия.
    const dialog = await loadedDialog("Местный падеж -DA");
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(
      dialog.getByRole("heading", { level: 2, name: "Примеры" }),
    );
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      showModal.mock.invocationCallOrder.at(-1) ?? Infinity,
    );
  });

  test("другая тема на блоке в уже открытом окне: прокрутка после её загрузки", async () => {
    await openMap("/?topic=vowel-harmony");
    await loadedDialog("Гармония гласных");
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    goTo("/?topic=locative-da#block-forms");
    const dialog = await loadedDialog("Местный падеж -DA");

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(
      dialog.getByRole("heading", { level: 2, name: "Формы" }),
    );
  });

  test("закрытие окна убирает блок из адреса", async () => {
    await openMap("/?topic=locative-da#block-pitfalls");
    await loadedDialog("Местный падеж -DA");

    await userEvent.click(
      topicDialog().getByRole("button", { name: "Закрыть" }),
    );

    expect(currentLocation()).toBe("/");
  });

  test("ссылка на тему внутри окна открывает её с начала", async () => {
    await openMap("/?topic=locative-da#block-pitfalls");
    const dialog = await loadedDialog("Местный падеж -DA");
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");

    await userEvent.click(
      within(dialog.getByRole("list", { name: "Пререквизиты" })).getByRole(
        "link",
        { name: "Гармония гласных" },
      ),
    );
    await loadedDialog("Гармония гласных");

    expect(currentLocation()).toBe("/?topic=vowel-harmony");
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  test("если такого блока у темы нет, окно открыто с начала", async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
    await openMap("/?topic=dative-a#block-examples");
    const dialog = await loadedDialog("Дательный падеж -(y)A");

    expect(dialog.getByText("Статья ещё не написана.")).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

describe("переходы внутри окна темы", () => {
  test("ссылка на пререквизит открывает его в том же окне и раскрывает его раздел", async () => {
    const map = await openMap("/?topic=locative-da");
    expect(sectionNode(map, "Фонетика и письмо")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    const dialog = await loadedDialog("Местный падеж -DA");
    const link = within(
      dialog.getByRole("list", { name: "Пререквизиты" }),
    ).getByRole("link", { name: "Гармония гласных" });
    expect(link).toHaveAttribute("href", "/?topic=vowel-harmony");

    await userEvent.click(link);

    expect(currentLocation()).toBe("/?topic=vowel-harmony");
    expect(await loadedDialog("Гармония гласных")).toBeDefined();
    expect(sectionNode(map, "Фонетика и письмо")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(topicNode(map, "Гармония гласных")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("ссылки «Не путать», «Связанные темы», в статье и по маршруту ведут на карту", async () => {
    await openMap("/?topic=locative-da");
    const dialog = await loadedDialog("Местный падеж -DA");

    const hrefs = (scope: Scope) =>
      scope.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(
      hrefs(within(dialog.getByRole("region", { name: "Не путать" }))),
    ).toEqual(["/?topic=dative-a"]);
    expect(
      hrefs(within(dialog.getByRole("region", { name: "Связанные темы" }))),
    ).toEqual(["/?topic=ablative-dan"]);
    expect(
      hrefs(within(dialog.getByRole("region", { name: "Формула" }))),
    ).toEqual(["/?topic=vowel-harmony"]);
    expect(
      hrefs(
        within(dialog.getByRole("navigation", { name: "Учебный маршрут" })),
      ),
    ).toEqual(["/?topic=dative-a", "/?topic=past-di"]);
  });

  test("переход по учебному маршруту открывает следующую тему в том же окне", async () => {
    await openMap("/?topic=locative-da");
    const dialog = await loadedDialog("Местный падеж -DA");

    await userEvent.click(
      dialog.getByRole("link", { name: /Следующая тема.*Прошедшее время -DI/ }),
    );

    expect(currentLocation()).toBe("/?topic=past-di");
    expect(await loadedDialog("Прошедшее время -DI")).toBeDefined();
  });

  test("кнопка браузера «Назад» возвращает предыдущую тему в окно", async () => {
    await openMap("/?topic=locative-da");
    const dialog = await loadedDialog("Местный падеж -DA");
    await userEvent.click(
      within(dialog.getByRole("list", { name: "Пререквизиты" })).getByRole(
        "link",
        { name: "Гармония гласных" },
      ),
    );
    await loadedDialog("Гармония гласных");

    goBack();

    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(await loadedDialog("Местный падеж -DA")).toBeDefined();
  });

  test("«Развернуть» открывает страницу темы", async () => {
    await openMap("/?topic=locative-da");
    const expand = topicDialog().getByRole("link", { name: "Развернуть" });
    expect(expand).toHaveAttribute("href", "/topics/locative-da");

    await userEvent.click(expand);

    expect(currentLocation()).toBe("/topics/locative-da");
    expect(
      await within(screen.getByRole("main")).findByRole("heading", {
        level: 1,
        name: "Местный падеж -DA",
      }),
    ).toBeInTheDocument();
    expect(queryDialog()).not.toBeInTheDocument();
  });
});

describe("адрес выбранной темы", () => {
  test("открытие адреса темы разворачивает её раздел, выбирает её и открывает окно", async () => {
    const map = await openMap("/?topic=locative-da");

    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(topicNode(map, "Местный падеж -DA")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(await loadedDialog("Местный падеж -DA")).toBeDefined();
  });

  test("тема выключенного уровня: уровень включается, тема выбрана", async () => {
    storeMapSettings({
      levels: new Set(["A1", "A2", "B1"]),
      layers: new Set(["contrasts"]),
      expanded: new Set(),
    });

    const map = await openMap("/?topic=ablative-dan");

    expect(screen.getByRole("button", { name: "B2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(topicNode(map, "Исходный падеж -DAn")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("несуществующая тема в адресе: карта без выбора, без окна и без ошибки", async () => {
    const map = await openMap("/?topic=no-such-topic");

    expect(queryDialog()).not.toBeInTheDocument();
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
  const firstVisit = renderApp("/");
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

  test("Enter на узле раздела разворачивает его, Enter на узле темы открывает её окно с фокусом внутри", async () => {
    const map = await openMap();

    sectionNode(map, "Существительное").focus();
    await userEvent.keyboard("{Enter}");
    expect(sectionNode(map, "Существительное")).toHaveAttribute(
      "aria-expanded",
      "true",
    );

    topicNode(map, "Местный падеж -DA").focus();
    await userEvent.keyboard("{Enter}");
    expect(await loadedDialog("Местный падеж -DA")).toBeDefined();
    expect(currentLocation()).toBe("/?topic=locative-da");
    expect(dialogElement()).toContainElement(
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
  });
});
