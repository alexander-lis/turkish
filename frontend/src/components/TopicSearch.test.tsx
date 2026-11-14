/**
 * Связка окна поиска с темами: требования «Состояния окна поиска», «Переход к найденной
 * теме», «Строка результата» и «Число результатов ограничено». Правила поиска проверяют
 * тесты src/lib/search.test.ts, клавиши и роли — тесты оболочки.
 */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { delay, http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";
import type { SearchTopic } from "../api/types.ts";
import { searchIndex } from "../test/fixtures.ts";
import { LocationProbe } from "../test/LocationProbe.tsx";
import { currentLocation, renderInRouter } from "../test/render.tsx";
import { server } from "../test/server.ts";
import { TopicSearch } from "./TopicSearch.tsx";

function renderSearch() {
  const onClose = vi.fn<() => void>();
  renderInRouter(
    <>
      <TopicSearch open onClose={onClose} />
      <LocationProbe />
    </>,
  );
  return { onClose, user: userEvent.setup() };
}

function field(): HTMLElement {
  return screen.getByRole("combobox", { name: "Поиск по темам" });
}

/** Подсказка видна, когда индекс загружен, а запрос пуст. */
function findHint(): Promise<HTMLElement> {
  return screen.findByText("Что можно искать");
}

/** Адреса строк списка по порядку: по ним видно, какие темы найдены. */
function rowAddresses(): (string | null)[] {
  return screen.getAllByRole("option").map((row) => row.getAttribute("href"));
}

function highlighted(row: HTMLElement): string[] {
  return [...row.querySelectorAll("mark")].map((mark) => mark.textContent);
}

/** Написанная тема, которой нет среди тестовых: примеры и блок из спецификации. */
const particleDa: SearchTopic = {
  id: "particle-da",
  title: "Частица dA: «тоже»",
  level: "A2",
  section_id: "particles",
  section_title: "Частицы",
  summary: "Добавляет слово к уже сказанному.",
  is_stub: false,
  is_overview: false,
  blocks: [
    { kind: "formula", lines: ["Частица стоит после слова."] },
    { kind: "pitfalls", lines: ["Частица не оглушается"] },
  ],
  examples: [{ tr: "Ben de geliyorum.", ru: "Я тоже иду.", note: null }],
};

function serveIndex(index: SearchTopic[]): void {
  server.use(http.get("*/api/search-index", () => HttpResponse.json(index)));
}

// --- Состояния окна поиска ---

test("при пустом запросе видна подсказка с примерами запросов, а списка тем нет", async () => {
  renderSearch();

  expect(await findHint()).toBeVisible();
  expect(screen.getByText("Название темы")).toBeVisible();
  expect(screen.getByText("Аффикс")).toBeVisible();
  expect(screen.getByText("Слово из примера или статьи")).toBeVisible();
  expect(screen.getByText("Без диакритики и регистра")).toBeVisible();
  expect(
    screen.getAllByRole("button").map((sample) => sample.textContent),
  ).toEqual([
    "местный падеж",
    "обзор времён",
    "-de",
    "ecek",
    "mış",
    "geliyorum",
    "оглушается",
    "cunku",
    "hala",
  ]);
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
});

test("нажатие на пример запроса подставляет его в поле, фокус остаётся в поле", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.click(screen.getByRole("button", { name: "местный падеж" }));

  expect(field()).toHaveValue("местный падеж");
  expect(field()).toHaveFocus();
  expect(screen.getByRole("option")).toHaveTextContent("Местный падеж -DA");
  expect(screen.queryByText("Что можно искать")).not.toBeInTheDocument();
});

test("пример запроса не забирает фокус ни нажатием, ни клавишей Tab", async () => {
  renderSearch();
  await findHint();

  for (const sample of screen.getAllByRole("button")) {
    expect(sample).toHaveAttribute("tabindex", "-1");
  }
});

test("запрос из одних пробелов и дефисов — пустой", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), " - ");

  expect(await findHint()).toBeVisible();
  expect(screen.queryByText("Ничего не найдено")).not.toBeInTheDocument();
});

test("если ничего не найдено, окно сообщает об этом", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "причастие");

  expect(screen.getByText("Ничего не найдено")).toBeVisible();
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(screen.getByText("Найдено тем: 0")).toHaveAttribute(
    "aria-live",
    "polite",
  );
});

test("пока индекс загружается, виден индикатор загрузки", async () => {
  // Сервер отвечает, только когда тест его отпустит: от скорости набора тест не зависит.
  let respond = (): void => undefined;
  const released = new Promise<void>((resolve) => {
    respond = resolve;
  });
  server.use(
    http.get("*/api/search-index", async () => {
      await released;
      return HttpResponse.json(searchIndex);
    }),
  );
  const { user } = renderSearch();

  await user.type(field(), "местный");
  expect(screen.getByRole("status")).toHaveTextContent("Загрузка");
  expect(screen.queryByRole("option")).not.toBeInTheDocument();

  respond();
  expect(await screen.findByRole("option")).toHaveTextContent(
    "Местный падеж -DA",
  );
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

test("при недоступном сервере видны сообщение об ошибке и кнопка повтора", async () => {
  server.use(http.get("*/api/search-index", () => HttpResponse.error()));
  const { user } = renderSearch();

  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("Не удалось загрузить данные");

  server.resetHandlers();
  await user.click(within(alert).getByRole("button", { name: "Повторить" }));

  expect(await findHint()).toBeVisible();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("индекс запрашивается, только когда окно открыто, и один раз", async () => {
  let requests = 0;
  server.use(
    http.get("*/api/search-index", () => {
      requests += 1;
      return HttpResponse.json(searchIndex);
    }),
  );
  renderInRouter(<TopicSearch open={false} onClose={vi.fn<() => void>()} />);
  await delay(20);
  expect(requests).toBe(0);

  const { user } = renderSearch();
  await findHint();
  await user.type(field(), "падеж");
  await user.clear(field());
  await user.type(field(), "местный");

  expect(requests).toBe(1);
});

// --- Строка результата ---

test("совпало название: строка показывает название с выделением, уровень и раздел", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "мест");

  const row = screen.getByRole("option");
  expect(row).toHaveTextContent("Местный падеж -DA");
  expect(within(row).getByText("A1")).toBeVisible();
  expect(within(row).getByText("Существительное")).toBeVisible();
  expect(highlighted(row)).toEqual(["Мест"]);
  expect(row).not.toHaveTextContent("не написано");
});

test("тема найдена по варианту формулы аффикса: в названии выделена формула", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "de");

  const [first] = screen.getAllByRole("option");
  expect(first).toHaveTextContent("Местный падеж -DA");
  expect(first === undefined ? [] : highlighted(first)).toEqual(["-DA"]);
});

test("совпал пример: подпись «Пример», турецкий текст с выделением и перевод", async () => {
  serveIndex([...searchIndex, particleDa]);
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "geliyorum");

  const row = screen.getByRole("option");
  expect(row).toHaveTextContent("Частица dA: «тоже»");
  expect(within(row).getByText("Пример")).toBeVisible();
  expect(row).toHaveTextContent("Ben de geliyorum. — Я тоже иду.");
  expect(highlighted(row)).toEqual(["geliyorum"]);
  expect(row).not.toHaveTextContent("Частицы");
});

test("совпал блок статьи: подпись с названием блока и фрагмент с выделением", async () => {
  serveIndex([...searchIndex, particleDa]);
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "оглушается");

  const row = screen.getByRole("option");
  expect(within(row).getByText("Подводные камни")).toBeVisible();
  expect(row).toHaveTextContent("Частица не оглушается");
  expect(highlighted(row)).toEqual(["оглушается"]);
});

test("совпала суть: подпись «Суть» и фрагмент с выделением", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "направлено");

  const row = screen.getByRole("option");
  expect(within(row).getByText("Суть")).toBeVisible();
  expect(row).toHaveTextContent("Показывает, куда направлено движение.");
  expect(highlighted(row)).toEqual(["направлено"]);
});

test("заглушка в списке помечена «не написано»", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "падеж");

  const [stub, written] = screen.getAllByRole("option");
  expect(stub).toHaveTextContent("Дательный падеж -(y)A");
  expect(stub).toHaveTextContent("не написано");
  expect(written).toHaveTextContent("Местный падеж -DA");
  expect(written).not.toHaveTextContent("не написано");
  expect(screen.getByText("Найдено тем: 4")).toHaveAttribute(
    "aria-live",
    "polite",
  );
});

test("найдено больше двадцати тем: в списке первые двадцать и общее число", async () => {
  serveIndex(
    Array.from({ length: 40 }, (_, number) => ({
      ...particleDa,
      id: `topic-${number}`,
      title: `Частица номер ${number}`,
    })),
  );
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "частица");

  const rows = screen.getAllByRole("option");
  expect(rows).toHaveLength(20);
  expect(rows[19]).toHaveTextContent("Частица номер 19");
  expect(screen.getByText("Найдено тем: 40, показаны первые 20")).toBeVisible();
});

// --- Переход к найденной теме ---

test("Enter по теме, найденной по названию, открывает её в окне темы и закрывает окно поиска", async () => {
  const { user, onClose } = renderSearch();
  await findHint();

  await user.type(field(), "местный{Enter}");

  expect(currentLocation()).toBe("/?topic=locative-da");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("совпадение в примере открывает окно темы на блоке «Примеры»", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "evdeyim{Enter}");

  expect(currentLocation()).toBe("/?topic=locative-da#block-examples");
});

test("нажатие на строку с совпадением в блоке статьи открывает окно темы на этом блоке", async () => {
  const { user, onClose } = renderSearch();
  await findHint();
  await user.type(field(), "отдельно");

  await user.click(screen.getByRole("option"));

  expect(currentLocation()).toBe("/?topic=locative-da#block-pitfalls");
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("каждая строка — ссылка на окно темы на карте", async () => {
  const { user } = renderSearch();
  await findHint();

  await user.type(field(), "падеж");

  expect(rowAddresses()).toEqual([
    "/?topic=dative-a",
    "/?topic=locative-da",
    "/?topic=ablative-dan",
    "/?topic=cases-overview",
  ]);
});

test("Ctrl+Enter открывает тему в новой вкладке, а текущая страница и окно остаются", async () => {
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  const { user, onClose } = renderSearch();
  await findHint();

  await user.type(field(), "evdeyim{Control>}{Enter}{/Control}");

  expect(open).toHaveBeenCalledExactlyOnceWith(
    "/?topic=locative-da#block-examples",
    "_blank",
    "noopener",
  );
  expect(currentLocation()).toBe("/");
  expect(onClose).not.toHaveBeenCalled();
  expect(field()).toHaveValue("evdeyim");
  open.mockRestore();
});
