import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { AffixText } from "./AffixText.tsx";

function unbreakable(container: HTMLElement): string[] {
  return [...container.querySelectorAll(".whitespace-nowrap")].map(
    (element) => element.textContent,
  );
}

test("запись аффикса и разбора не рвётся при переносе, обычные слова переносятся как обычно", () => {
  const { container } = render(
    <p>
      <AffixText>
        Сужение гласной перед -(I)yor: что-то вроде ev-ler-im-de и araba-s-ı.
      </AffixText>
    </p>,
  );

  expect(unbreakable(container)).toEqual([
    "-(I)yor:",
    "ev-ler-im-de",
    "araba-s-ı.",
  ]);
});

test("текст остаётся прежним", () => {
  const text = "Множественное число -lAr";
  const { container } = render(
    <p>
      <AffixText>{text}</AffixText>
    </p>,
  );

  expect(container).toHaveTextContent(text);
});
