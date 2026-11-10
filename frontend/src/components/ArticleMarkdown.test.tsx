/** Требования «Текст статьи отображается форматированным» и «Ссылки на темы ведут на их страницы». */
import { screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { renderInRouter } from "../test/render.tsx";
import { ArticleMarkdown } from "./ArticleMarkdown.tsx";

test("таблица отображается строками и столбцами внутри прокручиваемой области", () => {
  const markdown =
    "| После | Аффикс |\n| --- | --- |\n| a, ı, o, u | -da |\n| e, i, ö, ü | -de |";
  renderInRouter(<ArticleMarkdown>{markdown}</ArticleMarkdown>);

  const table = screen.getByRole("table");
  expect(within(table).getAllByRole("row")).toHaveLength(3);
  expect(
    within(table)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent),
  ).toEqual(["После", "Аффикс"]);
  expect(within(table).getByRole("cell", { name: "-de" })).toBeInTheDocument();
  expect(table.parentElement).toHaveClass("table-scroll");
});

test("списки, выделение и подзаголовки отображаются форматированными", () => {
  const markdown =
    "### После гласной\n\n- первый пункт\n- второй пункт\n\nЭто **важно** и *заметно*.";
  renderInRouter(<ArticleMarkdown>{markdown}</ArticleMarkdown>);

  expect(
    screen.getByRole("heading", { level: 3, name: "После гласной" }),
  ).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.getByText("важно").tagName).toBe("STRONG");
  expect(screen.getByText("заметно").tagName).toBe("EM");
});

test("зачёркнутая неверная форма отображается перечёркнутой", () => {
  renderInRouter(
    <ArticleMarkdown>{"Не ~~sokakda~~, а *sokakta*."}</ArticleMarkdown>,
  );

  expect(screen.getByText("sokakda").tagName).toBe("DEL");
  expect(screen.getByText("sokakta").closest("del")).toBeNull();
});

test("HTML в тексте статьи не исполняется", () => {
  const markdown =
    'Текст.\n\n<script>window.hacked = true</script>\n\n<img src="x" onerror="window.hacked = true">';
  const { container } = renderInRouter(
    <ArticleMarkdown>{markdown}</ArticleMarkdown>,
  );

  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector("img")).toBeNull();
  expect("hacked" in window).toBe(false);
});

test("ссылка вида topic:<id> ведёт на страницу темы", () => {
  renderInRouter(
    <ArticleMarkdown>
      {"См. [гармонию гласных](topic:vowel-harmony)."}
    </ArticleMarkdown>,
  );

  expect(
    screen.getByRole("link", { name: "гармонию гласных" }),
  ).toHaveAttribute("href", "/topics/vowel-harmony");
});

test("внешняя ссылка сохраняет свой адрес", () => {
  renderInRouter(
    <ArticleMarkdown>{"[Словарь](https://sozluk.gov.tr/)"}</ArticleMarkdown>,
  );

  expect(screen.getByRole("link", { name: "Словарь" })).toHaveAttribute(
    "href",
    "https://sozluk.gov.tr/",
  );
});
