/**
 * Требования «Окно поиска открывается кнопкой и сочетанием клавиш» и «Закрытие окна
 * поиска» и сценарий «Кнопка поиска в шапке» требования о шапке.
 */
import { act, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { currentLocation, renderApp } from "../test/render.tsx";

const SLOW = { timeout: 5000 };

afterEach(() => {
  vi.restoreAllMocks();
});

/** Шапка страницы — первая: шапку статьи темы Testing Library тоже считает шапкой. */
function header() {
  const [banner] = screen.getAllByRole("banner");
  if (banner === undefined) throw new Error("на странице нет шапки");
  return within(banner);
}

async function openTopicPage(): Promise<void> {
  renderApp("/topics/locative-da");
  await within(screen.getByRole("main")).findByRole("heading", { level: 1 });
}

/** Нажать клавишу K с модификаторами; false — действие браузера отменено. */
function pressK(init: KeyboardEventInit = { ctrlKey: true }): boolean {
  return fireEvent.keyDown(document.body, { code: "KeyK", key: "k", ...init });
}

function searchDialog(): HTMLDialogElement {
  return screen.getByRole("dialog", { name: "Поиск по темам" });
}

function querySearchDialog(): HTMLElement | null {
  return screen.queryByRole("dialog", { name: "Поиск по темам" });
}

function field(): HTMLElement {
  return screen.getByRole("combobox", { name: "Поиск по темам" });
}

// --- Окно поиска открывается кнопкой и сочетанием клавиш ---

test("Ctrl+K на странице темы открывает окно поиска с фокусом в пустом поле", async () => {
  await openTopicPage();
  expect(querySearchDialog()).not.toBeInTheDocument();

  pressK({ ctrlKey: true });

  expect(searchDialog()).toBeVisible();
  expect(field()).toHaveFocus();
  expect(field()).toHaveValue("");
});

test("кнопка поиска в шапке карты тем открывает то же окно", async () => {
  renderApp("/");
  await screen.findByRole("application", { name: "Карта тем" }, SLOW);

  await userEvent.click(header().getByRole("button", { name: "Поиск" }));

  expect(searchDialog()).toBeVisible();
  expect(field()).toHaveFocus();
});

test("при русской раскладке Cmd с той же клавишей открывает окно", async () => {
  await openTopicPage();

  pressK({ key: "л", metaKey: true });

  expect(searchDialog()).toBeVisible();
});

test("сочетание отменяет действие браузера", async () => {
  await openTopicPage();

  expect(pressK({ ctrlKey: true })).toBe(false);
});

test.each<[string, KeyboardEventInit]>([
  ["K без модификатора", {}],
  ["Ctrl+Shift+K", { ctrlKey: true, shiftKey: true }],
  ["Ctrl+Alt+K", { ctrlKey: true, altKey: true }],
  ["буква k на другой клавише", { ctrlKey: true, code: "KeyR" }],
])("%s окно не открывает", async (_name, init) => {
  await openTopicPage();

  expect(pressK(init)).toBe(true);

  expect(querySearchDialog()).not.toBeInTheDocument();
});

test("при открытом окне темы окно поиска открывается поверх него", async () => {
  renderApp("/?topic=locative-da");
  const topicDialog = await screen.findByRole(
    "dialog",
    { name: "Местный падеж -DA" },
    SLOW,
  );

  pressK({ ctrlKey: true });

  expect(searchDialog()).toBeVisible();
  expect(topicDialog).toBeVisible();
  expect(currentLocation()).toBe("/?topic=locative-da");
});

// --- Закрытие окна поиска ---

test("Escape закрывает окно, адрес страницы остаётся прежним", async () => {
  await openTopicPage();
  pressK();
  const dialog = searchDialog();

  // Escape обрабатывает браузер: он закрывает окно и посылает событие close.
  act(() => {
    dialog.close();
  });

  expect(querySearchDialog()).not.toBeInTheDocument();
  expect(currentLocation()).toBe("/topics/locative-da");
});

test("повторное сочетание закрывает окно", async () => {
  await openTopicPage();
  pressK({ metaKey: true });
  expect(searchDialog()).toBeVisible();

  pressK({ metaKey: true });

  expect(querySearchDialog()).not.toBeInTheDocument();
  expect(currentLocation()).toBe("/topics/locative-da");
});

test("нажатие на затемнение вокруг окна закрывает его", async () => {
  await openTopicPage();
  pressK();
  const dialog = searchDialog();

  fireEvent.mouseDown(dialog);
  fireEvent.click(dialog);

  expect(querySearchDialog()).not.toBeInTheDocument();
});

test.each([
  ["сочетанием", () => void pressK()],
  ["клавишей Escape", () => searchDialog().close()],
])("запрос не сохраняется после закрытия окна %s", async (_name, close) => {
  const user = userEvent.setup();
  await openTopicPage();
  pressK();
  await user.type(field(), "падеж");
  expect(await screen.findAllByRole("option")).not.toHaveLength(0);

  act(close);
  expect(querySearchDialog()).not.toBeInTheDocument();
  pressK();

  expect(field()).toHaveValue("");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
});

// --- Кнопка поиска в шапке ---

test.each(["/topics/locative-da", "/notation", "/no/such/page"])(
  "в шапке страницы %s есть кнопка поиска и ссылка «Карта тем», других элементов навигации нет",
  (route) => {
    renderApp(route);

    expect(
      header()
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Турецкая грамматика", "Карта тем"]);
    expect(
      header()
        .getAllByRole("button")
        .map((button) => button.getAttribute("aria-label")),
    ).toEqual(["Поиск"]);
  },
);

test.each([
  [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15",
    "⌘K",
  ],
  [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101",
    "Ctrl K",
  ],
  ["Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36", "Ctrl K"],
])("кнопка подсказывает сочетание клавиш системы: %s", (userAgent, hint) => {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
  renderApp("/notation");

  const button = header().getByRole("button", { name: "Поиск" });
  expect(within(button).getByText(hint)).toBeInTheDocument();
});

// --- Поиск из шапки открывает тему в окне темы ---

test("на карте тем Enter открывает найденную тему в окне темы", async () => {
  const user = userEvent.setup();
  renderApp("/");
  await screen.findByRole("application", { name: "Карта тем" }, SLOW);
  pressK();

  await user.type(field(), "местный");
  await screen.findByRole("option");
  await user.keyboard("{Enter}");

  expect(currentLocation()).toBe("/?topic=locative-da");
  expect(querySearchDialog()).not.toBeInTheDocument();
  const topicDialog = screen.getByRole("dialog", { name: "Местный падеж -DA" });
  expect(
    await within(topicDialog).findByRole("heading", {
      level: 1,
      name: "Местный падеж -DA",
    }),
  ).toBeVisible();
});

test("со страницы темы Enter открывает карту с найденной темой в окне темы", async () => {
  const user = userEvent.setup();
  await openTopicPage();
  pressK();

  await user.type(field(), "гармония");
  await screen.findAllByRole("option");
  await user.keyboard("{Enter}");

  expect(currentLocation()).toBe("/?topic=vowel-harmony");
  expect(querySearchDialog()).not.toBeInTheDocument();
  expect(
    await screen.findByRole("dialog", { name: "Гармония гласных" }, SLOW),
  ).toBeVisible();
  expect(
    await screen.findByRole("application", { name: "Карта тем" }, SLOW),
  ).toBeInTheDocument();
});

test("при открытом окне темы Enter показывает в нём найденную тему", async () => {
  const user = userEvent.setup();
  renderApp("/?topic=locative-da");
  await screen.findByRole("dialog", { name: "Местный падеж -DA" }, SLOW);
  pressK();

  await user.type(field(), "гармония");
  await screen.findAllByRole("option");
  await user.keyboard("{Enter}");

  expect(currentLocation()).toBe("/?topic=vowel-harmony");
  expect(querySearchDialog()).not.toBeInTheDocument();
  expect(
    screen.getByRole("dialog", { name: "Гармония гласных" }),
  ).toBeVisible();
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});
