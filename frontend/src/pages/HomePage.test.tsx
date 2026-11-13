/**
 * Требования «Главная страница показывает маршрут по уровням», «Заглушки отличимы в списках»
 * и «Обзор помечен в списках».
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { renderApp } from "../test/render.tsx";

async function homePage() {
  const main = within(screen.getByRole("main"));
  await main.findByRole("link", { name: "Гармония гласных" });
  return main;
}

test("темы сгруппированы по уровням от A1 до B2 и идут в порядке маршрута", async () => {
  renderApp("/");
  const main = await homePage();

  const levels = main
    .getAllByRole("heading", { level: 2 })
    .map((heading) => heading.textContent.replace(/тем: \d+/, ""));
  expect(levels).toEqual(["A1", "A2", "B1", "B2"]);

  const a1 = within(main.getByRole("region", { name: /^A1/ }));
  expect(a1.getAllByRole("link").map((link) => link.textContent)).toEqual([
    "Гармония гласных",
    "Множественное число -lAr",
    "Обзор падежей",
    "Дательный падеж -(y)A",
    "Местный падеж -DA",
  ]);
});

test("у темы видны название, раздел и суть", async () => {
  renderApp("/");
  const main = await homePage();

  const item = main
    .getByRole("link", { name: "Местный падеж -DA" })
    .closest("li");
  expect(item).toHaveTextContent("Существительное");
  expect(item).toHaveTextContent("Показывает, где что-то находится.");
});

test("нажатие на тему открывает её страницу", async () => {
  const user = userEvent.setup();
  renderApp("/");
  const main = await homePage();

  await user.click(main.getByRole("link", { name: "Местный падеж -DA" }));

  expect(
    await main.findByRole("heading", { level: 1, name: "Местный падеж -DA" }),
  ).toBeInTheDocument();
});

test("заглушка помечена «не написано», написанная тема — нет", async () => {
  renderApp("/");
  const main = await homePage();

  const stub = main
    .getByRole("link", { name: "Прошедшее время -DI" })
    .closest("li");
  const written = main
    .getByRole("link", { name: "Гармония гласных" })
    .closest("li");
  expect(stub).toHaveTextContent("не написано");
  expect(written).not.toHaveTextContent("не написано");
});

test("обзор помечен «обзор», тема без тем обзора — нет", async () => {
  renderApp("/");
  const main = await homePage();

  const overview = main
    .getByRole("link", { name: "Обзор падежей" })
    .closest("li");
  const topic = main
    .getByRole("link", { name: "Местный падеж -DA" })
    .closest("li");
  if (overview === null || topic === null) {
    throw new Error("тема стоит вне списка");
  }
  expect(within(overview).getByText("обзор")).toBeInTheDocument();
  expect(within(overview).queryByText("не написано")).not.toBeInTheDocument();
  expect(within(topic).queryByText("обзор")).not.toBeInTheDocument();
});

test("у обзора-заглушки видны обе пометки: «обзор» и «не написано»", async () => {
  renderApp("/");
  const main = await homePage();

  const overview = main
    .getByRole("link", { name: "Обзор времён" })
    .closest("li");
  if (overview === null) {
    throw new Error("тема стоит вне списка");
  }
  expect(within(overview).getByText("обзор")).toBeInTheDocument();
  expect(within(overview).getByText("не написано")).toBeInTheDocument();
});
