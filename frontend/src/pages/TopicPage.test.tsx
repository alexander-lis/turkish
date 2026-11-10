/**
 * Требования «Страница темы следует шаблону», «Пререквизиты на странице темы»,
 * «Переходы по учебному маршруту», «Страница заглушки», «У каждой темы постоянный адрес»
 * и переходы по ссылкам на темы.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { renderApp, type Scope } from "../test/render.tsx";

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

test("тема со всеми блоками показывает шесть блоков в порядке шаблона", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  expect(blockTitles(main)).toEqual([
    "Формула",
    "Формы",
    "Примеры",
    "Подводные камни",
    "Сравнение с русским",
    "Связанные темы",
  ]);
});

test("страница темы показывает название, уровень, раздел и суть", async () => {
  renderApp("/topics/locative-da");
  const main = await topicPage("Местный падеж -DA");

  const title = main.getByRole("heading", { level: 1 });
  const header = within(title.parentElement!);
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
  expect(
    link.compareDocumentPosition(firstBlock) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await user.click(link);
  expect(await topicPage("Гармония гласных")).toBeDefined();
});

test("у темы без пререквизитов списка пререквизитов нет", async () => {
  renderApp("/topics/vowel-harmony");
  const main = await topicPage("Гармония гласных");

  expect(main.queryByText("Пререквизиты")).not.toBeInTheDocument();
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
      name: /Предыдущая тема.*Множественное число -lAr/,
    }),
  ).toHaveAttribute("href", "/topics/plural-lar");
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
  expect(blockTitles(main)).toEqual([]);

  const path = within(
    main.getByRole("navigation", { name: "Учебный маршрут" }),
  );
  expect(path.getByRole("link", { name: /Предыдущая тема/ })).toHaveAttribute(
    "href",
    "/topics/locative-da",
  );
  expect(path.getByRole("link", { name: /Следующая тема/ })).toHaveAttribute(
    "href",
    "/topics/passive-il",
  );
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
