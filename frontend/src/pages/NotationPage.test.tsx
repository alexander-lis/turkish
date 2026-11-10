/** Требование «Страница обозначений». */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { renderApp } from "../test/render.tsx";

test("страница показывает вводный текст и таблицу всех обозначений", async () => {
  renderApp("/notation");
  const main = within(screen.getByRole("main"));

  const table = await main.findByRole("table");
  expect(main.getByText("чередующийся звук").tagName).toBe("STRONG");
  expect(
    within(table)
      .getAllByRole("row")
      .slice(1)
      .map((row) => [
        within(row).getByRole("rowheader").textContent,
        within(row).getByRole("cell").textContent,
      ]),
  ).toEqual([
    ["МН", "множественное число"],
    ["МЕСТ", "местный падеж"],
    ["1ЕД", "первое лицо единственного числа"],
  ]);
});

test("страница открывается из навигации на любой странице", async () => {
  const user = userEvent.setup();
  renderApp("/topics/past-di");
  const navigation = within(
    screen.getByRole("navigation", { name: "Темы справочника" }),
  );

  await user.click(navigation.getByRole("link", { name: "Обозначения" }));

  const main = within(screen.getByRole("main"));
  expect(
    await main.findByRole("heading", { level: 1, name: "Обозначения" }),
  ).toBeInTheDocument();
  expect(await main.findByRole("table")).toBeInTheDocument();
});
