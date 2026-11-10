/**
 * Требования «Панель навигации с двумя группировками», «Выбранная группировка сохраняется»
 * и «Заглушки отличимы в списках» — в части панели.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { renderApp, type Scope } from "../test/render.tsx";

async function navPanel() {
  const panel = within(
    screen.getByRole("navigation", { name: "Темы справочника" }),
  );
  await panel.findByRole("link", { name: /Гармония гласных/ });
  return panel;
}

function groupTitles(panel: Scope): string[] {
  return panel
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent);
}

function topicTitlesIn(panel: Scope, group: string): string[] {
  const region = panel.getByRole("region", { name: group });
  return within(region)
    .getAllByRole("link")
    .map((link) => link.textContent.replace("не написано", ""));
}

test("по умолчанию панель показывает темы по уровням в порядке маршрута", async () => {
  renderApp("/");
  const panel = await navPanel();

  expect(panel.getByRole("button", { name: "По маршруту" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(groupTitles(panel)).toEqual(["A1", "A2", "B1", "B2"]);
  expect(topicTitlesIn(panel, "A1")).toEqual([
    "Гармония гласных",
    "Множественное число -lAr",
    "Местный падеж -DA",
  ]);
});

test("группировка «По разделам» показывает разделы в заданном порядке, а темы — в порядке маршрута", async () => {
  const user = userEvent.setup();
  renderApp("/");
  const panel = await navPanel();

  await user.click(panel.getByRole("button", { name: "По разделам" }));

  expect(groupTitles(panel)).toEqual([
    "Существительное",
    "Фонетика и письмо",
    "Времена глагола",
  ]);
  expect(topicTitlesIn(panel, "Существительное")).toEqual([
    "Множественное число -lAr",
    "Местный падеж -DA",
    "Исходный падеж -DAn",
  ]);
  expect(topicTitlesIn(panel, "Времена глагола")).toEqual([
    "Прошедшее время -DI",
    "Страдательный залог -Il",
  ]);
});

test("открытая тема выделена в панели", async () => {
  renderApp("/topics/locative-da");
  const panel = await navPanel();

  expect(
    panel.getByRole("link", { name: "Местный падеж -DA" }),
  ).toHaveAttribute("aria-current", "page");
  expect(
    panel.getByRole("link", { name: "Гармония гласных" }),
  ).not.toHaveAttribute("aria-current");
});

test("выбранная группировка сохраняется после перезагрузки страницы", async () => {
  const user = userEvent.setup();
  const firstVisit = renderApp("/");
  await user.click(
    (await navPanel()).getByRole("button", { name: "По разделам" }),
  );
  firstVisit.unmount();

  renderApp("/");
  const panel = await navPanel();

  expect(panel.getByRole("button", { name: "По разделам" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(groupTitles(panel)).toContain("Существительное");
});

test("выбранная группировка сохраняется при переходе между страницами", async () => {
  const user = userEvent.setup();
  renderApp("/");
  const panel = await navPanel();
  await user.click(panel.getByRole("button", { name: "По разделам" }));

  await user.click(panel.getByRole("link", { name: "Местный падеж -DA" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Местный падеж -DA" }),
  ).toBeInTheDocument();
  expect(groupTitles(panel)).toContain("Существительное");
});

test("заглушка в панели помечена «не написано», написанная тема — нет", async () => {
  renderApp("/");
  const panel = await navPanel();

  expect(
    panel.getByRole("link", { name: /Прошедшее время -DI/ }),
  ).toHaveTextContent("не написано");
  expect(
    panel.getByRole("link", { name: /Гармония гласных/ }),
  ).not.toHaveTextContent("не написано");
});

test("ссылка «Обозначения» в панели открывает страницу обозначений", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const panel = await navPanel();

  await user.click(panel.getByRole("link", { name: "Обозначения" }));

  expect(
    await screen.findByRole("heading", { level: 1, name: "Обозначения" }),
  ).toBeInTheDocument();
});

test("кнопка в шапке открывает панель, а переход по ссылке закрывает её", async () => {
  const user = userEvent.setup();
  renderApp("/");
  const panel = await navPanel();
  const button = screen.getByRole("button", { name: "Открыть навигацию" });
  expect(button).toHaveAttribute("aria-expanded", "false");

  await user.click(button);
  expect(button).toHaveAttribute("aria-expanded", "true");

  await user.click(panel.getByRole("link", { name: "Местный падеж -DA" }));
  expect(button).toHaveAttribute("aria-expanded", "false");
});
