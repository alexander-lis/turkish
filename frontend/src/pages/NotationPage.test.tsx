/** Требование «Страница обозначений открывается из примеров». */
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

test("ссылка «Обозначения» из блока «Примеры» открывает вводный текст и таблицу", async () => {
  const user = userEvent.setup();
  renderApp("/topics/locative-da");
  const main = within(screen.getByRole("main"));
  const examples = within(await main.findByRole("region", { name: "Примеры" }));

  await user.click(examples.getByRole("link", { name: "Обозначения" }));

  expect(
    await main.findByRole("heading", { level: 1, name: "Обозначения" }),
  ).toBeInTheDocument();
  expect(await main.findByRole("table")).toBeInTheDocument();
  expect(main.getByText("чередующийся звук")).toBeInTheDocument();
});
