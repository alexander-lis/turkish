/**
 * Требования «Страница темы следует шаблону», «Пререквизиты на странице темы»,
 * «Обзоры и темы обзора на странице темы», «Блок «Не путать»», «Переходы по учебному маршруту»,
 * «Страница заглушки», «У каждой темы постоянный адрес» и переходы по ссылкам на темы.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, test } from "vitest";
import { locativeDa, ref } from "../test/fixtures.ts";
import { renderApp, type Scope } from "../test/render.tsx";
import { server } from "../test/server.ts";

async function topicPage(title: string) {
  const main = within(screen.getByRole("main"));
  await main.findByRole("heading", { level: 1, name: title });
  return main;
}

function blockTitles(main: Scope): string[] {
  return main
    .queryAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

function linkTitles(scope: Scope): string[] {
  return scope.getAllByRole("link").map((link) => link.textContent);
}

/** Различения блока «Не путать»: по элементу списка на каждое. */
function contrasts(main: Scope): HTMLElement[] {
  const block = within(main.getByRole("region", { name: "Не путать" }));
  return block.getAllByRole("listitem");
}

function isBefore(first: HTMLElement, second: HTMLElement): boolean {
  return Boolean(
    first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
}

test("тема со всеми блоками показывает семь блоков в порядке шаблона", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  expect(blockTitles(main)).toEqual([
    "Формула",
    "Формы",
    "Примеры",
    "Подводные камни",
    "Сравнение с русским",
    "Не путать",
    "Связанные темы",
  ]);
});

test("страница темы показывает название, уровень, раздел и суть", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const title = main.getByRole("heading", { level: 1 });
  const parent = title.parentElement;
  if (parent === null) throw new Error("у заголовка темы нет родителя");
  const header = within(parent);
  expect(header.getByText("A1")).toBeInTheDocument();
  expect(header.getByText("Существительное")).toBeInTheDocument();
  expect(
    header.getByText("Показывает, где что-то находится."),
  ).toBeInTheDocument();
});

test("содержимое блоков стоит под своими заголовками", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  expect(
    within(main.getByRole("region", { name: "Формы" })).getByRole("table"),
  ).toBeInTheDocument();
  expect(
    within(main.getByRole("region", { name: "Примеры" })).getAllByRole(
      "listitem",
    ),
  ).toHaveLength(3);
  expect(
    main.getByRole("region", { name: "Подводные камни" }),
  ).toHaveTextContent("Частица da пишется отдельно.");
});

test("блоков, для которых у темы нет содержимого, на странице нет", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(blockTitles(main)).toEqual(["Формула", "Примеры", "Подводные камни"]);
  expect(main.queryByText("Сравнение с русским")).not.toBeInTheDocument();
  expect(main.queryByText("Не путать")).not.toBeInTheDocument();
  expect(main.queryByText("Связанные темы")).not.toBeInTheDocument();
});

test("пререквизиты показаны ссылками в начале страницы, до блоков статьи", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const prerequisites = main.getByRole("list", { name: "Пререквизиты" });
  const link = within(prerequisites).getByRole("link", {
    name: "Гармония гласных",
  });
  const firstBlock = main.getByRole("heading", { level: 2, name: "Формула" });
  expect(isBefore(link, firstBlock)).toBe(true);

  await user.click(link);
  expect(await topicPage("Гармония гласных")).toBeDefined();
});

test("у темы без пререквизитов списка пререквизитов нет", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(main.queryByText("Пререквизиты")).not.toBeInTheDocument();
});

test("списка «Нужна для» на странице темы нет: он есть в окне темы на карте", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(main.queryByText("Нужна для")).not.toBeInTheDocument();
});

test("тема показывает обзор, в который входит, ссылкой в начале страницы", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const overviews = main.getByRole("list", { name: "Входит в обзор" });
  const link = within(overviews).getByRole("link", { name: "Обзор падежей" });
  expect(
    isBefore(link, main.getByRole("heading", { level: 2, name: "Формула" })),
  ).toBe(true);
  expect(main.queryByText("Темы обзора")).not.toBeInTheDocument();

  await user.click(link);
  expect(await topicPage("Обзор падежей")).toBeDefined();
});

test("страница обзора показывает темы обзора ссылками в порядке контента", async () => {
  renderApp("/topics/cases-overview");
  const main = await topicPage("Обзор падежей");

  const members = main.getByRole("list", { name: "Темы обзора" });
  expect(linkTitles(within(members))).toEqual([
    "Местный падеж -DA",
    "Дательный падеж -(y)A",
    "Исходный падеж -DAn",
  ]);
  expect(
    within(members).getByRole("link", { name: "Местный падеж -DA" }),
  ).toHaveAttribute("href", "/topics/locative-da");
  expect(
    isBefore(members, main.getByRole("heading", { level: 2, name: "Формула" })),
  ).toBe(true);
  expect(main.queryByText("Входит в обзор")).not.toBeInTheDocument();
});

test("заглушка среди тем обзора помечена «не написано»", async () => {
  renderApp("/topics/cases-overview");
  const main = await topicPage("Обзор падежей");

  const [written, stub] = within(
    main.getByRole("list", { name: "Темы обзора" }),
  ).getAllByRole("listitem");
  expect(written).not.toHaveTextContent("не написано");
  expect(stub).toHaveTextContent("не написано");
});

test("у темы вне обзоров нет ни обзоров, ни тем обзора", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(main.queryByText("Входит в обзор")).not.toBeInTheDocument();
  expect(main.queryByText("Темы обзора")).not.toBeInTheDocument();
});

test("различение, разобранное в этой теме, показано без ссылки «Разбор»", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const [contrast, ...rest] = contrasts(main);
  if (contrast === undefined) throw new Error("в блоке нет различений");
  expect(rest).toHaveLength(0);
  expect(contrast).toHaveTextContent("«Где» и «куда»: -DA и -(y)A");
  expect(linkTitles(within(contrast))).toEqual(["Дательный падеж -(y)A"]);
  expect(contrast).not.toHaveTextContent("Разбор");

  await user.click(within(contrast).getByRole("link"));
  expect(await topicPage("Дательный падеж -(y)A")).toBeDefined();
});

test("различение, разобранное в другой теме, показывает ссылку «Разбор» на неё", async () => {
  renderApp("/topics/past-di");
  const main = await topicPage("Прошедшее время -DI");

  const [contrast] = contrasts(main);
  if (contrast === undefined) throw new Error("в блоке нет различений");
  expect(contrast).toHaveTextContent("-DI и -mIş");
  expect(linkTitles(within(contrast))).toEqual([
    "Прошедшее время -mIş",
    "Обзор времён",
  ]);
  const explanation = within(contrast).getByText(/Разбор/).parentElement;
  if (explanation === null) throw new Error("у подписи «Разбор» нет строки");
  expect(
    within(explanation).getByRole("link", { name: "Обзор времён" }),
  ).toHaveAttribute("href", "/topics/tense-overview");
});

test("различение трёх тем показывает ссылки на обе другие темы", async () => {
  server.use(
    http.get("*/api/topics/locative-da", () =>
      HttpResponse.json({
        ...locativeDa,
        contrasts: [
          {
            title: "«Где», «куда» и «откуда»",
            topics: [ref("dative-a"), ref("ablative-dan")],
            explained_in: [ref("locative-da"), ref("cases-overview")],
          },
        ],
      }),
    ),
  );
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const [contrast] = contrasts(main);
  if (contrast === undefined) throw new Error("в блоке нет различений");
  expect(linkTitles(within(contrast))).toEqual([
    "Дательный падеж -(y)A",
    "Исходный падеж -DAn",
    "Обзор падежей",
  ]);
  expect(
    within(contrast).queryByRole("link", { name: "Местный падеж -DA" }),
  ).not.toBeInTheDocument();
});

test("ссылка на следующую тему открывает следующую тему маршрута", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const path = within(
    main.getByRole("navigation", { name: "Учебный маршрут" }),
  );
  expect(
    path.getByRole("link", {
      name: /Предыдущая тема.*Дательный падеж -\(y\)A/,
    }),
  ).toHaveAttribute("href", "/topics/dative-a");
  await user.click(
    path.getByRole("link", { name: /Следующая тема.*Прошедшее время -DI/ }),
  );

  expect(await topicPage("Прошедшее время -DI")).toBeDefined();
});

test("у первой темы маршрута есть ссылка на следующую и нет ссылки на предыдущую", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  const path = within(
    main.getByRole("navigation", { name: "Учебный маршрут" }),
  );
  expect(path.getByRole("link", { name: /Следующая тема/ })).toHaveAttribute(
    "href",
    "/topics/plural-lar",
  );
  expect(
    path.queryByRole("link", { name: /Предыдущая тема/ }),
  ).not.toBeInTheDocument();
});

test("у последней темы маршрута нет ссылки на следующую", async () => {
  renderApp("/topics/ablative-dan");
  const main = await topicPage("Исходный падеж -DAn");

  const path = within(
    main.getByRole("navigation", { name: "Учебный маршрут" }),
  );
  expect(
    path.getByRole("link", { name: /Предыдущая тема/ }),
  ).toBeInTheDocument();
  expect(
    path.queryByRole("link", { name: /Следующая тема/ }),
  ).not.toBeInTheDocument();
});

test("страница заглушки показывает суть, сообщение и переходы по маршруту", async () => {
  renderApp("/topics/past-di");
  const main = await topicPage("Прошедшее время -DI");

  expect(main.getByText("A2")).toBeInTheDocument();
  expect(main.getByText("Времена глагола")).toBeInTheDocument();
  expect(
    main.getByText("Действие, которое говорящий видел сам."),
  ).toBeInTheDocument();
  expect(
    within(main.getByRole("list", { name: "Пререквизиты" })).getByRole("link", {
      name: "Гармония гласных",
    }),
  ).toBeInTheDocument();
  expect(main.getByText("Статья ещё не написана.")).toBeInTheDocument();
  expect(blockTitles(main)).toEqual(["Не путать", "Связанные темы"]);

  const path = within(
    main.getByRole("navigation", { name: "Учебный маршрут" }),
  );
  expect(path.getByRole("link", { name: /Предыдущая тема/ })).toHaveAttribute(
    "href",
    "/topics/locative-da",
  );
  expect(path.getByRole("link", { name: /Следующая тема/ })).toHaveAttribute(
    "href",
    "/topics/past-mis",
  );
});

test("страница обзора-заглушки показывает темы обзора и сообщение", async () => {
  renderApp("/topics/tense-overview");
  const main = await topicPage("Обзор времён");

  expect(
    linkTitles(within(main.getByRole("list", { name: "Темы обзора" }))),
  ).toEqual(["Прошедшее время -DI", "Прошедшее время -mIş"]);
  expect(main.getByText("Статья ещё не написана.")).toBeInTheDocument();
  expect(blockTitles(main)).toEqual([]);
});

test("у заглушки блоки «Не путать» и «Связанные темы» стоят под сообщением", async () => {
  renderApp("/topics/past-di");
  const main = await topicPage("Прошедшее время -DI");

  const message = main.getByText("Статья ещё не написана.");
  const contrastsBlock = main.getByRole("region", { name: "Не путать" });
  const related = main.getByRole("region", { name: "Связанные темы" });
  expect(isBefore(message, contrastsBlock)).toBe(true);
  expect(isBefore(contrastsBlock, related)).toBe(true);
  expect(contrastsBlock).toHaveTextContent("-DI и -mIş");
  expect(
    within(related).getByRole("link", { name: "Страдательный залог -Il" }),
  ).toHaveAttribute("href", "/topics/passive-il");
});

test("прямое открытие адреса темы показывает эту тему", async () => {
  renderApp("/topics/locative-da");

  expect(await topicPage("Местный падеж -DA")).toBeDefined();
});

test("ссылка вида topic:<id> в тексте статьи открывает страницу темы", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  await user.click(
    within(main.getByRole("region", { name: "Формула" })).getByRole("link", {
      name: "гармония гласных",
    }),
  );

  expect(await topicPage("Гармония гласных")).toBeDefined();
});

test("ссылка в блоке «Связанные темы» открывает страницу темы", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  await user.click(
    within(main.getByRole("region", { name: "Связанные темы" })).getByRole(
      "link",
      { name: "Исходный падеж -DAn" },
    ),
  );

  expect(await topicPage("Исходный падеж -DAn")).toBeDefined();
});

test("в блоке примеров темы с разбором есть ссылка на «Обозначения»", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  await user.click(
    within(main.getByRole("region", { name: "Примеры" })).getByRole("link", {
      name: "Обозначения",
    }),
  );

  expect(
    await main.findByRole("heading", { level: 1, name: "Обозначения" }),
  ).toBeInTheDocument();
});

test("в блоке примеров темы без разборов ссылки на «Обозначения» нет", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(
    within(main.getByRole("region", { name: "Примеры" })).queryByRole("link", {
      name: "Обозначения",
    }),
  ).not.toBeInTheDocument();
});

test("заглушка среди связанных тем помечена «не написано»", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  expect(
    main.getByRole("region", { name: "Связанные темы" }),
  ).toHaveTextContent("не написано");
});

test("ссылки «Показать на карте» на странице темы нет: на карту возвращает шапка", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  expect(
    main.queryByRole("link", { name: "Показать на карте" }),
  ).not.toBeInTheDocument();
});
