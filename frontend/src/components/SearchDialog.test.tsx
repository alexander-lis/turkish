/**
 * Оболочка окна поиска: требования «Выбор строки с клавиатуры и мышью» и «Окно поиска
 * доступно программам чтения с экрана». Строки здесь — не темы: оболочка о темах не знает.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useMemo, useState } from "react";
import { expect, test, vi } from "vitest";
import { SearchDialog, type SearchRow } from "./SearchDialog.tsx";

interface CityRow extends SearchRow {
  title: string;
}

const CITIES: CityRow[] = [
  { id: "ankara", href: "/cities/ankara", title: "Ankara" },
  { id: "antalya", href: "/cities/antalya", title: "Antalya" },
  { id: "adana", href: "/cities/adana", title: "Adana" },
  { id: "bursa", href: "/cities/bursa", title: "Bursa" },
  { id: "izmir", href: "/cities/izmir", title: "İzmir" },
];

type Select = (row: CityRow, target: "same-tab" | "new-tab") => void;

interface HarnessProps {
  open?: boolean;
  onSelect?: Select;
  onClose?: () => void;
}

/** Тот, кто открыл окно: хранит запрос и сам отбирает строки. */
function Harness({
  open = true,
  onSelect = vi.fn<Select>(),
  onClose = vi.fn<() => void>(),
}: HarnessProps) {
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => CITIES.filter((city) => city.title.toLowerCase().includes(query)),
    [query],
  );
  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      label="Поиск города"
      placeholder="Название города"
      query={query}
      onQueryChange={setQuery}
      rows={rows}
      renderRow={(row) => <span>{row.title}</span>}
      onSelect={onSelect}
      status={<p>Такого города нет</p>}
      summary={`Городов: ${rows.length}`}
    />
  );
}

function field(): HTMLElement {
  return screen.getByRole("combobox", { name: "Поиск города" });
}

function option(name: string): HTMLElement {
  return screen.getByRole("option", { name });
}

function selectedTitles(): string[] {
  return screen
    .getAllByRole("option", { selected: true })
    .map((row) => row.textContent);
}

test("поле — combobox, список — listbox, строки — option", () => {
  render(<Harness />);

  const listbox = screen.getByRole("listbox");
  expect(field()).toHaveAttribute("aria-controls", listbox.id);
  expect(field()).toHaveAttribute("aria-autocomplete", "list");
  expect(field()).toHaveAttribute("aria-expanded", "true");
  expect(field()).toHaveAttribute("placeholder", "Название города");
  expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
    "Ankara",
    "Antalya",
    "Adana",
    "Bursa",
    "İzmir",
  ]);
  for (const row of screen.getAllByRole("option")) {
    expect(listbox).toContainElement(row);
  }
});

test("при открытии фокус стоит в поле запроса и выбрана первая строка", () => {
  render(<Harness />);

  expect(field()).toHaveFocus();
  expect(selectedTitles()).toEqual(["Ankara"]);
});

test("стрелка вниз выбирает вторую строку, фокус остаётся в поле", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  await user.keyboard("{ArrowDown}");

  expect(selectedTitles()).toEqual(["Antalya"]);
  expect(field()).toHaveFocus();
});

test("выбранная строка сообщается через поле запроса", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  expect(field()).toHaveAttribute("aria-activedescendant", option("Ankara").id);

  await user.keyboard("{ArrowDown}");

  expect(field()).toHaveAttribute(
    "aria-activedescendant",
    option("Antalya").id,
  );
  expect(option("Antalya").id).not.toBe(option("Ankara").id);
});

test("стрелки останавливаются на краях списка", async () => {
  const user = userEvent.setup();
  render(<Harness />);

  await user.keyboard("{ArrowUp}");
  expect(selectedTitles()).toEqual(["Ankara"]);

  await user.keyboard("{ArrowDown>10/}");
  expect(selectedTitles()).toEqual(["İzmir"]);

  await user.keyboard("{ArrowUp}");
  expect(selectedTitles()).toEqual(["Bursa"]);
});

test("стрелка не двигает курсор в поле", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.type(field(), "an");

  expect(fireEvent.keyDown(field(), { key: "ArrowDown" })).toBe(false);
  expect(fireEvent.keyDown(field(), { key: "ArrowUp" })).toBe(false);
});

test("после изменения запроса выбранной становится первая строка нового списка", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(selectedTitles()).toEqual(["Adana"]);

  await user.type(field(), "an");

  expect(screen.getAllByRole("option").map((row) => row.textContent)).toEqual([
    "Ankara",
    "Antalya",
    "Adana",
  ]);
  expect(selectedTitles()).toEqual(["Ankara"]);
});

test("строка, выбранная стрелкой, прокручивается в видимую область", async () => {
  const user = userEvent.setup();
  const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
  render(<Harness />);

  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");

  expect(scrollIntoView).toHaveBeenCalledTimes(3);
  expect(scrollIntoView).toHaveBeenLastCalledWith({ block: "nearest" });
  expect(scrollIntoView.mock.contexts.at(-1)).toBe(option("Bursa"));
  scrollIntoView.mockRestore();
});

test("движение указателя над строкой делает её выбранной", () => {
  const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView");
  render(<Harness />);

  fireEvent.pointerMove(option("Bursa"));

  expect(selectedTitles()).toEqual(["Bursa"]);
  expect(field()).toHaveFocus();
  // Под указателем строка и так видна: список не прокручивается.
  expect(scrollIntoView).not.toHaveBeenCalled();
  scrollIntoView.mockRestore();
});

test("Enter выбирает строку в той же вкладке", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn<Select>();
  render(<Harness onSelect={onSelect} />);

  await user.keyboard("{ArrowDown}{Enter}");

  expect(onSelect).toHaveBeenCalledExactlyOnceWith(CITIES[1], "same-tab");
});

test.each(["Control", "Meta"])(
  "Enter с клавишей %s выбирает строку в новой вкладке",
  async (modifier) => {
    const user = userEvent.setup();
    const onSelect = vi.fn<Select>();
    render(<Harness onSelect={onSelect} />);

    await user.keyboard(`{${modifier}>}{Enter}{/${modifier}}`);

    expect(onSelect).toHaveBeenCalledExactlyOnceWith(CITIES[0], "new-tab");
  },
);

test("Enter, которым подтверждается набор в редакторе метода ввода, строку не выбирает", () => {
  const onSelect = vi.fn<Select>();
  render(<Harness onSelect={onSelect} />);

  fireEvent.keyDown(field(), { key: "Enter", isComposing: true });

  expect(onSelect).not.toHaveBeenCalled();
});

test("нажатие на строку выбирает её в той же вкладке вместо перехода по ссылке", () => {
  const onSelect = vi.fn<Select>();
  render(<Harness onSelect={onSelect} />);

  const followed = fireEvent.click(option("Adana"));

  expect(followed).toBe(false);
  expect(onSelect).toHaveBeenCalledExactlyOnceWith(CITIES[2], "same-tab");
});

test("строка — ссылка: нажатие с клавишей-модификатором оболочка оставляет браузеру", () => {
  const onSelect = vi.fn<Select>();
  render(<Harness onSelect={onSelect} />);
  expect(option("Adana")).toHaveAttribute("href", "/cities/adana");
  // Переходить по ссылке в jsdom некуда: переход отменяется уже за пределами оболочки,
  // после того как стало видно, что сама она его не отменила.
  let cancelledByDialog: boolean | undefined;
  document.addEventListener(
    "click",
    (event) => {
      cancelledByDialog = event.defaultPrevented;
      event.preventDefault();
    },
    { once: true },
  );

  fireEvent.click(option("Adana"), { ctrlKey: true });

  expect(cancelledByDialog).toBe(false);
  expect(onSelect).not.toHaveBeenCalled();
});

test("нажатие на строку не забирает фокус у поля", () => {
  render(<Harness />);

  expect(fireEvent.mouseDown(option("Adana"))).toBe(false);
  expect(field()).toHaveFocus();
});

test("когда строк нет, вместо списка показан status", async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn<Select>();
  render(<Harness onSelect={onSelect} />);
  expect(screen.queryByText("Такого города нет")).not.toBeInTheDocument();

  await user.type(field(), "zzz");

  expect(screen.getByText("Такого города нет")).toBeVisible();
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(field()).toHaveAttribute("aria-expanded", "false");
  expect(field()).not.toHaveAttribute("aria-activedescendant");

  await user.keyboard("{Enter}");
  expect(onSelect).not.toHaveBeenCalled();
});

test("summary стоит в области, которую объявляют программы чтения с экрана", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  const summary = screen.getByText("Городов: 5");
  expect(summary).toHaveAttribute("aria-live", "polite");

  await user.type(field(), "an");

  expect(summary).toHaveTextContent("Городов: 3");

  // Без строк область итога остаётся на месте: её изменение объявляется и тогда.
  await user.type(field(), "zzz");
  expect(summary).toHaveTextContent("Городов: 0");
  expect(summary).toHaveAttribute("aria-live", "polite");
});

test("закрытое окно не показано; open открывает его модальным", () => {
  const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");
  const { rerender } = render(<Harness open={false} />);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(showModal).not.toHaveBeenCalled();

  rerender(<Harness open />);

  expect(screen.getByRole("dialog", { name: "Поиск города" })).toBeVisible();
  expect(showModal).toHaveBeenCalledTimes(1);
  expect(field()).toHaveFocus();
  showModal.mockRestore();
});

test("снятый open закрывает окно и не сообщает о закрытии", () => {
  const onClose = vi.fn<() => void>();
  const { rerender } = render(<Harness onClose={onClose} />);

  rerender(<Harness open={false} onClose={onClose} />);

  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).not.toHaveBeenCalled();
});

test("окно, закрытое браузером по Escape, сообщает о закрытии", () => {
  const onClose = vi.fn<() => void>();
  render(<Harness onClose={onClose} />);
  const dialog = screen.getByRole<HTMLDialogElement>("dialog");

  // Escape обрабатывает браузер: он закрывает окно и посылает событие close.
  act(() => {
    dialog.close();
  });

  expect(onClose).toHaveBeenCalledTimes(1);
});

test("нажатие на затемнение вокруг окна сообщает о закрытии, нажатие внутри — нет", () => {
  const onClose = vi.fn<() => void>();
  render(<Harness onClose={onClose} />);
  const dialog = screen.getByRole("dialog");

  fireEvent.mouseDown(field());
  fireEvent.click(field());
  expect(onClose).not.toHaveBeenCalled();

  // Содержимое занимает всю площадь окна: сам <dialog> под указателем — это затемнение.
  fireEvent.mouseDown(dialog);
  fireEvent.click(dialog);
  expect(onClose).toHaveBeenCalledTimes(1);
});
