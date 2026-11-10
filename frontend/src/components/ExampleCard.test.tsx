/**
 * Требования «Отображение примера», «Разбор по морфемам выровнен»
 * и «Язык интерфейса и разметка турецкого текста».
 */
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import indexHtml from "../../index.html?raw";
import type { Example } from "../api/types.ts";
import { locativeDa } from "../test/fixtures.ts";
import { ExampleCard } from "./ExampleCard.tsx";

const [emphasized, glossed, generated] = locativeDa.examples as [
  Example,
  Example,
  Example,
];

function renderExample(example: Example) {
  render(
    <ul>
      <ExampleCard example={example} />
    </ul>,
  );
  return within(screen.getByRole("listitem"));
}

test("пример показывает турецкий текст и перевод, выделенный фрагмент выделен", () => {
  const card = renderExample(emphasized);

  const fragment = card.getByText("de");
  expect(fragment.tagName).toBe("MARK");
  expect(fragment.parentElement).toHaveTextContent("Evdeyim.");
  expect(card.getByText("дома").tagName).toBe("MARK");
  expect(card.getByText("дома").parentElement).toHaveTextContent("Я дома.");
});

test("примечание показывается, если оно есть", () => {
  expect(
    renderExample(emphasized).getByText("Последняя гласная слова — e."),
  ).toBeInTheDocument();
});

test("сгенерированный пример помечен «сгенерировано»", () => {
  expect(renderExample(generated).getByText("сгенерировано")).toBeVisible();
});

test("у авторского примера пометки «сгенерировано» нет", () => {
  expect(
    renderExample(emphasized).queryByText("сгенерировано"),
  ).not.toBeInTheDocument();
});

test("под каждой морфемой разбора стоит её значение", () => {
  const card = renderExample(glossed);

  const gloss = within(card.getByRole("group", { name: "Разбор по морфемам" }));
  const [forms, meanings] = within(gloss.getByRole("table")).getAllByRole(
    "row",
  ) as [HTMLElement, HTMLElement];
  const columns = within(forms)
    .getAllByRole("cell")
    .map((cell, index) => [
      cell.textContent,
      within(meanings).getAllByRole("cell")[index]?.textContent,
    ]);
  expect(columns).toEqual([
    ["ev", "дом"],
    ["ler", "МН"],
    ["im", "1ЕД.ПРИТ"],
    ["de", "МЕСТ"],
  ]);
});

test("обозначения в разборе оформлены иначе, чем лексические значения", () => {
  const card = renderExample(glossed);

  expect(card.getByText("МН").tagName).toBe("ABBR");
  expect(card.getByText("1ЕД").tagName).toBe("ABBR");
  expect(card.getByText("ПРИТ").tagName).toBe("ABBR");
  expect(card.getByText("дом").tagName).not.toBe("ABBR");
});

test("у примера без разбора блока разбора нет", () => {
  const card = renderExample(emphasized);

  expect(
    card.queryByRole("group", { name: "Разбор по морфемам" }),
  ).not.toBeInTheDocument();
});

test("турецкий текст примера и разбора помечен языком tr, перевод — нет", () => {
  const card = renderExample(glossed);

  expect(card.getByText("Evlerimde.")).toHaveAttribute("lang", "tr");
  expect(card.getByText("ler").closest("[lang]")).toHaveAttribute("lang", "tr");
  expect(card.getByText("В моих домах.").closest("[lang]")).toBeNull();
  expect(card.getByText("МН").closest("[lang]")).toBeNull();
});

test("страница в целом помечена языком ru", () => {
  expect(indexHtml).toContain('<html lang="ru">');
});
