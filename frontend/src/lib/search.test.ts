/**
 * Правила поиска из спецификации topic-search: что находится, в каком порядке и что
 * показывает строка результата. Окно поиска проверяют тесты компонентов.
 */
import { describe, expect, test } from "vitest";
import type { SearchTopic } from "../api/types.ts";
import { searchIndex } from "../test/fixtures.ts";
import { isAffixFormula } from "./affixFormula.ts";
import {
  prepareIndex,
  searchTopics,
  type FoundTopic,
  type Fragment,
} from "./search.ts";

/** Запись индекса для одного теста: названо только то, что тесту важно. */
function topic(
  id: string,
  title: string,
  rest: Partial<SearchTopic> = {},
): SearchTopic {
  return {
    id,
    title,
    level: "A1",
    section_id: "nouns",
    section_title: "Существительное",
    summary: "",
    is_stub: false,
    is_overview: false,
    blocks: [],
    examples: [],
    ...rest,
  };
}

const particleDa = topic("particle-da", "Частица dA: «тоже»", {
  section_id: "particles",
  section_title: "Частицы",
  summary: "Добавляет слово к уже сказанному.",
  blocks: [
    {
      kind: "formula",
      lines: [
        "Частица стоит после слова, к которому относится: kitaplar da.",
        "Гласную выбирает гармония гласных.",
      ],
    },
    {
      kind: "pitfalls",
      lines: [
        "Частица не оглушается",
        "После глухого согласного пишут kitap da, а не kitap ta.",
      ],
    },
  ],
  examples: [
    { tr: "Ben de geliyorum.", ru: "Я тоже иду.", note: null },
    { tr: "Evde de çalışıyorum.", ru: "Я и дома работаю.", note: null },
  ],
});

const locativeDa = topic("locative-da", "Местный падеж -DA", {
  summary: "Показывает, где что-то находится.",
});

/** Темы с названиями из сценариев спецификации, в порядке учебного маршрута. */
const scenarioIndex: SearchTopic[] = [
  topic("vowel-harmony", "Гармония гласных", {
    section_id: "phonetics",
    section_title: "Фонетика и письмо",
  }),
  topic("dative-a", "Дательный падеж -(y)A", {
    summary: "Показывает, куда направлено движение.",
    is_stub: true,
  }),
  locativeDa,
  topic("instrumental-la", "Совместно-орудийный падеж -(y)lA и ile"),
  particleDa,
  topic("future-acak", "Будущее время -(y)AcAK"),
  topic("aorist-r", "Настоящее-будущее время -(A/I)r"),
  topic("conjunction-cunku", "Союз çünkü: «потому что»"),
  topic("adverbs-still", "artık, hâlâ, henüz, daha: «уже, ещё»"),
  topic(
    "conjunction-ki",
    "Союз ki и связки с ним: demek ki, yeter ki, öyle ki",
  ),
  topic("converb-ken", "-(y)ken: «пока, когда»", {
    summary: "Действие, на фоне которого идёт другое.",
  }),
];

function search(index: readonly SearchTopic[], query: string): FoundTopic[] {
  return searchTopics(prepareIndex(index), query).topics;
}

function found(index: readonly SearchTopic[], query: string): string[] {
  return search(index, query).map((row) => row.topic.id);
}

/** Единственная найденная тема с этим идентификатором. */
function row(
  index: readonly SearchTopic[],
  query: string,
  id: string,
): FoundTopic {
  const rows = search(index, query).filter((candidate) => {
    return candidate.topic.id === id;
  });
  const [only] = rows;
  if (only === undefined || rows.length !== 1) {
    throw new Error(`тема ${id} найдена не один раз: ${rows.length}`);
  }
  return only;
}

function fragmentText(fragment: Fragment): string {
  return fragment.map((part) => part.text).join("");
}

function matched(fragment: Fragment): string[] {
  return fragment.filter((part) => part.matched).map((part) => part.text);
}

describe("поиск находит темы по вхождению", () => {
  test("часть слова в названии", () => {
    expect(found(scenarioIndex, "датель")).toContain("dative-a");
    // «Страдательный» содержит запрос в середине слова, поэтому стоит ниже.
    expect(found(searchIndex, "датель")).toEqual(["dative-a", "passive-il"]);
  });

  test("слово из примера", () => {
    expect(found(scenarioIndex, "geliyorum")).toEqual(["particle-da"]);
  });

  test("слово из перевода и из примечания примера", () => {
    expect(found(searchIndex, "школе")).toEqual(["locative-da"]);
    expect(found(searchIndex, "последняя")).toEqual(["locative-da"]);
  });

  test("слово из текста статьи", () => {
    expect(found(scenarioIndex, "оглушается")).toEqual(["particle-da"]);
  });

  test("слово, которое в статье разбито выделением", () => {
    expect(found(scenarioIndex, "kitaplar")).toEqual(["particle-da"]);
    expect(found(searchIndex, "kitaplar")).toEqual(["plural-lar"]);
  });

  test("адрес ссылки и идентификатор темы в поиске не участвуют", () => {
    expect(found(scenarioIndex, "гармония")).toContain("particle-da");
    expect(found(scenarioIndex, "vowel")).toEqual([]);
    expect(found(searchIndex, "vowel")).toEqual([]);
  });

  test("слово из сути заглушки", () => {
    expect(found(scenarioIndex, "направлено")).toEqual(["dative-a"]);
    expect(found(searchIndex, "движение")).toEqual([
      "dative-a",
      "ablative-dan",
    ]);
  });

  test("пустой запрос ничего не находит", () => {
    expect(searchTopics(prepareIndex(searchIndex), "  ")).toEqual({
      topics: [],
      total: 0,
    });
  });
});

describe("слово короче двух символов ищется только в названии", () => {
  test("один символ не ищется в сути, примерах и статье", () => {
    const index = [
      topic("with-letter", "Указательные местоимения"),
      topic("without-letter", "Обзор времён", {
        summary: "Я вижу действие.",
        blocks: [{ kind: "formula", lines: ["Я и ты."] }],
        examples: [{ tr: "Geliyorum.", ru: "Я иду.", note: "Я." }],
      }),
    ];

    expect(found(index, "я")).toEqual(["with-letter"]);
  });

  test("два символа ищутся и в текстах", () => {
    const index = [
      topic("in-text", "Обзор времён", { summary: "Он уже ушёл." }),
    ];

    expect(found(index, "уж")).toEqual(["in-text"]);
  });
});

describe("регистр и диакритика не влияют на поиск", () => {
  test("запрос без диакритики", () => {
    expect(found(scenarioIndex, "cunku")).toEqual(["conjunction-cunku"]);
  });

  test("запрос заглавными буквами", () => {
    expect(found(scenarioIndex, "ÇÜNKÜ")).toEqual(["conjunction-cunku"]);
  });

  test("циркумфлекс и «ё»", () => {
    expect(found(scenarioIndex, "hala")).toEqual(["adverbs-still"]);
    expect(found(scenarioIndex, "еще")).toEqual(["adverbs-still"]);
  });

  test("запрос с диакритикой находит слово без неё в тексте", () => {
    expect(found(scenarioIndex, "çalışıyorum")).toEqual(["particle-da"]);
    expect(found(scenarioIndex, "calisiyorum")).toEqual(["particle-da"]);
  });
});

describe("формула аффикса находится по своим вариантам", () => {
  test("вариант гласной и согласного", () => {
    expect(found(scenarioIndex, "de")[0]).toBe("locative-da");
    expect(found(scenarioIndex, "ta")[0]).toBe("locative-da");
    expect(found(searchIndex, "de")[0]).toBe("locative-da");
    expect(found(searchIndex, "ta")[0]).toBe("locative-da");
  });

  test("часть в скобках", () => {
    expect(found(scenarioIndex, "ecek")).toEqual(["future-acak"]);
    expect(found(scenarioIndex, "yacak")).toEqual(["future-acak"]);
  });

  test("косая черта", () => {
    expect(found(scenarioIndex, "ır")[0]).toBe("aorist-r");
    expect(found(scenarioIndex, "ar")[0]).toBe("aorist-r");
  });

  test("строчная буква не чередуется", () => {
    expect(found(scenarioIndex, "ken")).toContain("converb-ken");
    expect(found(scenarioIndex, "yken")).toEqual(["converb-ken"]);
    expect(found(scenarioIndex, "kan")).not.toContain("converb-ken");
  });

  test("запись с дефисом и сама формула — тот же запрос", () => {
    expect(found(scenarioIndex, "-de")).toEqual(found(scenarioIndex, "de"));
    expect(found(scenarioIndex, "-(y)AcAK")).toEqual(["future-acak"]);
  });

  test("слова названий тестового индекса формулами не считаются", () => {
    const formulas = searchIndex
      .flatMap((entry) => entry.title.split(" "))
      .filter(isAffixFormula);

    expect(formulas).toEqual([
      "-lAr",
      "-(y)A",
      "-DA",
      "-DI",
      "-mIş",
      "-Il",
      "-DAn",
    ]);
  });
});

describe("слова запроса ищутся по отдельности", () => {
  test("другой порядок слов", () => {
    expect(found(scenarioIndex, "падеж мест")).toContain("locative-da");
    expect(found(searchIndex, "падеж мест")).toEqual(["locative-da"]);
  });

  test("слова в разных текстах", () => {
    expect(found(scenarioIndex, "частица оглушается")).toEqual(["particle-da"]);
    expect(found(scenarioIndex, "geliyorum тоже сказанному")).toEqual([
      "particle-da",
    ]);
  });

  test("одного слова нет", () => {
    expect(found(scenarioIndex, "местный причастие")).toEqual([]);
    expect(found(searchIndex, "местный причастие")).toEqual([]);
  });
});

describe("порядок результатов по месту совпадения", () => {
  /** Маршрут идёт от худшего совпадения к лучшему: порядок задаёт только ступень. */
  const byPlace = [
    topic("in-article", "Порядок слов", {
      blocks: [{ kind: "formula", lines: ["Здесь работает гармония."] }],
    }),
    topic("in-example", "Обзор времён", {
      examples: [{ tr: "Uyum.", ru: "Гармония.", note: null }],
    }),
    topic("in-note", "Обзор залогов", {
      examples: [{ tr: "Uyum.", ru: "Лад.", note: "Это гармония." }],
    }),
    topic("in-summary", "Обзор падежей", { summary: "Гармония важна." }),
    topic("in-title", "Гармония гласных"),
  ];

  test("название выше сути, суть выше примеров, примеры выше текста статьи", () => {
    expect(found(byPlace, "гармония")).toEqual([
      "in-title",
      "in-summary",
      "in-example",
      "in-note",
      "in-article",
    ]);
  });

  test("при равенстве раньше идёт тема, которая раньше в учебном маршруте", () => {
    // У обзора слово названия только начинается с запроса, поэтому он ниже.
    expect(found(searchIndex, "падеж")).toEqual([
      "dative-a",
      "locative-da",
      "ablative-dan",
      "cases-overview",
    ]);
  });

  test("место темы определяет слово, которое совпало хуже остальных", () => {
    const index = [
      topic("title-and-article", "Местный падеж -DA", {
        blocks: [{ kind: "pitfalls", lines: ["Аффикс оглушается."] }],
      }),
      topic("in-example", "Частица dA", {
        examples: [
          {
            tr: "Kitapta.",
            ru: "Местный падеж оглушается.",
            note: null,
          },
        ],
      }),
    ];

    expect(found(index, "местный оглушается")).toEqual([
      "in-example",
      "title-and-article",
    ]);
    expect(found(index, "местный")).toEqual([
      "title-and-article",
      "in-example",
    ]);
  });
});

describe("порядок совпадений с названием", () => {
  test("формула выше начала слова", () => {
    const ids = found(scenarioIndex, "de");

    expect(ids[0]).toBe("locative-da");
    expect(ids.indexOf("locative-da")).toBeLessThan(
      ids.indexOf("conjunction-ki"),
    );
  });

  test("начало слова выше середины", () => {
    const index = [
      topic("inside", "Совместный падеж"),
      topic("starts", "Местный падеж -DA"),
    ];

    expect(found(index, "мест")).toEqual(["starts", "inside"]);
    expect(found(scenarioIndex, "мест").slice(0, 2)).toEqual([
      "locative-da",
      "instrumental-la",
    ]);
  });

  test("слово, равное запросу, выше слова, которое с него начинается", () => {
    const index = [
      topic("starts", "Падежи и послелоги"),
      topic("equal", "Местный падеж -DA"),
    ];

    expect(found(index, "падеж")).toEqual(["equal", "starts"]);
  });
});

describe("число результатов ограничено", () => {
  const forty = Array.from({ length: 40 }, (_, number) =>
    topic(`topic-${number}`, `Падеж номер ${number}`),
  );

  test("найдено больше двадцати тем", () => {
    const result = searchTopics(prepareIndex(forty), "падеж");

    expect(result.total).toBe(40);
    expect(result.topics.map((entry) => entry.topic.id)).toEqual(
      forty.slice(0, 20).map((entry) => entry.id),
    );
  });

  test("найдено меньше двадцати тем", () => {
    const result = searchTopics(prepareIndex(forty.slice(0, 3)), "падеж");

    expect(result.total).toBe(3);
    expect(result.topics).toHaveLength(3);
  });
});

describe("строка результата", () => {
  test("совпало название: строка показывает раздел", () => {
    const result = row(searchIndex, "местный", "locative-da");

    expect(result.place).toEqual({ kind: "title" });
    expect(result.topic.title).toBe("Местный падеж -DA");
    expect(result.topic.level).toBe("A1");
    expect(result.topic.section_title).toBe("Существительное");
  });

  test("совпала суть: фрагмент сути с выделенным словом", () => {
    const result = row(searchIndex, "ДВИЖЕНИЕ", "dative-a");

    expect(result.place).toEqual({
      kind: "summary",
      fragment: [
        { text: "Показывает, куда направлено ", matched: false },
        { text: "движение", matched: true },
        { text: ".", matched: false },
      ],
    });
  });

  test("совпал пример: турецкий текст с выделением и перевод", () => {
    const result = row(scenarioIndex, "geliyorum", "particle-da");

    expect(result.place).toEqual({
      kind: "example",
      tr: [
        { text: "Ben de ", matched: false },
        { text: "geliyorum", matched: true },
        { text: ".", matched: false },
      ],
      ru: [{ text: "Я тоже иду.", matched: false }],
    });
  });

  test("совпал перевод: выделение стоит в переводе", () => {
    const result = row(scenarioIndex, "работаю", "particle-da");

    expect(result.place).toEqual({
      kind: "example",
      tr: [{ text: "Evde de çalışıyorum.", matched: false }],
      ru: [
        { text: "Я и дома ", matched: false },
        { text: "работаю", matched: true },
        { text: ".", matched: false },
      ],
    });
  });

  test("совпало только примечание: вместо перевода стоит оно", () => {
    const result = row(searchIndex, "гласная слова", "locative-da");

    expect(result.place).toEqual({
      kind: "example",
      tr: [{ text: "Evdeyim.", matched: false }],
      ru: [
        { text: "Последняя ", matched: false },
        { text: "гласная", matched: true },
        { text: " ", matched: false },
        { text: "слова", matched: true },
        { text: " — e.", matched: false },
      ],
    });
  });

  test("совпал блок статьи: вид блока и фрагмент с выделенным словом", () => {
    const result = row(scenarioIndex, "оглушается", "particle-da");

    expect(result.place).toEqual({
      kind: "block",
      block: "pitfalls",
      fragment: [
        { text: "Частица не ", matched: false },
        { text: "оглушается", matched: true },
      ],
    });
  });

  test("выделение повторяет написание текста, а не запроса", () => {
    const result = row(scenarioIndex, "CALISIYORUM", "particle-da");

    expect(result.place).toMatchObject({
      tr: [
        { text: "Evde de ", matched: false },
        { text: "çalışıyorum", matched: true },
        { text: ".", matched: false },
      ],
    });
  });

  test("тема, найденная в нескольких местах, занимает одну строку с разделом", () => {
    const index = [
      topic("locative-da", "Местный падеж -DA", {
        summary: "Аффикс -da после основы.",
        blocks: [{ kind: "formula", lines: ["Основа + -da."] }],
        examples: [
          { tr: "Okulda.", ru: "В школе.", note: null },
          { tr: "Odada.", ru: "В комнате.", note: null },
          { tr: "Arabada.", ru: "В машине.", note: null },
        ],
      }),
    ];

    expect(row(index, "da", "locative-da").place).toEqual({ kind: "title" });
  });

  test("у заглушки в строке есть признак заглушки", () => {
    expect(row(searchIndex, "датель", "dative-a").topic.is_stub).toBe(true);
    expect(row(searchIndex, "местный", "locative-da").topic.is_stub).toBe(
      false,
    );
  });

  test("из строк берётся первая, в которой есть все слова запроса", () => {
    const index = [
      topic("lines", "Порядок слов", {
        blocks: [
          { kind: "formula", lines: ["Сказуемое стоит в конце."] },
          {
            kind: "pitfalls",
            lines: ["Подлежащее стоит в начале.", "В конце стоит сказуемое."],
          },
        ],
      }),
    ];

    expect(row(index, "конце подлежащее", "lines").place).toMatchObject({
      block: "formula",
      fragment: [
        { text: "Сказуемое стоит в ", matched: false },
        { text: "конце", matched: true },
        { text: ".", matched: false },
      ],
    });
    expect(row(index, "стоит начале", "lines").place).toMatchObject({
      block: "pitfalls",
      fragment: [
        { text: "Подлежащее ", matched: false },
        { text: "стоит", matched: true },
        { text: " в ", matched: false },
        { text: "начале", matched: true },
        { text: ".", matched: false },
      ],
    });
  });

  test("слово из одного символа в тексте не выделяется", () => {
    const index = [
      topic("with-letter", "Формы я и ты", {
        blocks: [{ kind: "formula", lines: ["Я вижу, я иду."] }],
      }),
    ];

    expect(row(index, "я иду", "with-letter").place).toMatchObject({
      fragment: [
        { text: "Я вижу, я ", matched: false },
        { text: "иду", matched: true },
        { text: ".", matched: false },
      ],
    });
  });
});

describe("выделение в названии", () => {
  function title(index: readonly SearchTopic[], query: string, id: string) {
    return row(index, query, id).title;
  }

  test("в обычном слове выделяется само вхождение, в написании названия", () => {
    expect(title(searchIndex, "мест", "locative-da")).toEqual([
      { text: "Мест", matched: true },
      { text: "ный падеж -DA", matched: false },
    ]);
    expect(title(scenarioIndex, "CUNKU", "conjunction-cunku")).toEqual([
      { text: "Союз ", matched: false },
      { text: "çünkü", matched: true },
      { text: ": «потому что»", matched: false },
    ]);
  });

  test("вхождение в середине слова тоже выделяется", () => {
    expect(title(searchIndex, "датель", "passive-il")).toEqual([
      { text: "Стра", matched: false },
      { text: "датель", matched: true },
      { text: "ный залог -Il", matched: false },
    ]);
  });

  test("формула аффикса, найденная по варианту, выделяется целиком", () => {
    expect(title(searchIndex, "de", "locative-da")).toEqual([
      { text: "Местный падеж ", matched: false },
      { text: "-DA", matched: true },
    ]);
    expect(matched(title(scenarioIndex, "ecek", "future-acak"))).toEqual([
      "-(y)AcAK",
    ]);
    expect(matched(title(scenarioIndex, "ır", "aorist-r"))).toEqual([
      "-(A/I)r",
    ]);
  });

  test("формула выделяется целиком и по части варианта, и по самой записи", () => {
    expect(matched(title(scenarioIndex, "ece", "future-acak"))).toEqual([
      "-(y)AcAK",
    ]);
    expect(matched(title(scenarioIndex, "-(y)AcAK", "future-acak"))).toEqual([
      "-(y)AcAK",
    ]);
  });

  test("выделяются все слова запроса, в любом порядке", () => {
    expect(title(searchIndex, "падеж мест", "locative-da")).toEqual([
      { text: "Мест", matched: true },
      { text: "ный ", matched: false },
      { text: "падеж", matched: true },
      { text: " -DA", matched: false },
    ]);
    expect(matched(title(searchIndex, "ta местный", "locative-da"))).toEqual([
      "Местный",
      "-DA",
    ]);
  });

  test("слово из одного символа выделяется в названии", () => {
    const index = [topic("with-letter", "Указательные местоимения")];

    expect(matched(title(index, "я", "with-letter"))).toEqual(["я"]);
  });

  test("у темы, найденной только по тексту, название без выделения", () => {
    expect(title(scenarioIndex, "geliyorum", "particle-da")).toEqual([
      { text: "Частица dA: «тоже»", matched: false },
    ]);
  });

  test("слово, совпавшее с названием, выделено и у темы, найденной по тексту", () => {
    const found = row(scenarioIndex, "частица оглушается", "particle-da");

    expect(found.place).toMatchObject({ kind: "block", block: "pitfalls" });
    expect(matched(found.title)).toEqual(["Частица"]);
  });

  test("строчная буква формулы не чередуется и в выделении", () => {
    const index = [
      topic("converb-ken", "-(y)ken: «пока, когда»", {
        summary: "Слово kan здесь ни при чём.",
      }),
    ];

    expect(matched(title(index, "kan", "converb-ken"))).toEqual([]);
    expect(matched(title(index, "ken", "converb-ken"))).toEqual(["-(y)ken"]);
  });
});

describe("фрагмент", () => {
  const before =
    "В турецком языке согласный аффикса подстраивается под последний звук основы, и это правило работает почти без исключений;";
  const after =
    "а вот отдельное слово, которое пишется через пробел, своего согласного не меняет никогда, как бы ни звучала основа перед ним.";
  const long = `${before} частица при этом не оглушается, ${after}`;

  function blockFragment(text: string, query: string): Fragment {
    const index = [
      topic("long", "Порядок слов", {
        blocks: [{ kind: "pitfalls", lines: [text] }],
      }),
    ];
    const { place } = row(index, query, "long");
    if (place.kind !== "block") {
      throw new Error(`совпал не блок статьи: ${place.kind}`);
    }
    return place.fragment;
  }

  test("длинная строка обрезается окном вокруг совпадения по границам слов", () => {
    const fragment = blockFragment(long, "оглушается");
    const text = fragmentText(fragment);
    const shown = text.slice(1, -1);

    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(shown.length).toBeLessThanOrEqual(120);
    expect(shown.length).toBeGreaterThan(80);
    expect(matched(fragment)).toEqual(["оглушается"]);
    // Окно — кусок строки, и слова на его краях целые.
    const from = long.indexOf(shown);
    expect(from).toBeGreaterThan(0);
    expect(long[from - 1]).toBe(" ");
    expect(long[from + shown.length]).toBe(" ");
  });

  test("совпадение в начале длинной строки: многоточие только в конце", () => {
    const text = fragmentText(blockFragment(long, "турецком"));

    expect(text.startsWith("В турецком языке")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(121);
  });

  test("совпадение в конце длинной строки: многоточие только в начале", () => {
    const text = fragmentText(blockFragment(long, "звучала"));

    expect(text.startsWith("…")).toBe(true);
    expect(text.endsWith("основа перед ним.")).toBe(true);
    expect(text.length).toBeLessThanOrEqual(121);
  });

  test("короткая строка показывается целиком", () => {
    const fragment = blockFragment("Частица не оглушается.", "частица");

    expect(fragmentText(fragment)).toBe("Частица не оглушается.");
  });

  test("выделяются все вхождения всех слов запроса внутри окна", () => {
    const fragment = blockFragment(
      "Частица da и частица de — одна частица.",
      "частица de",
    );

    expect(matched(fragment)).toEqual(["Частица", "частица", "de", "частица"]);
  });

  test("окно стоит вокруг первого совпадения, вхождения за его краем не выделяются", () => {
    const fragment = blockFragment(long, "оглушается турецком");

    expect(fragmentText(fragment).startsWith("В турецком языке")).toBe(true);
    expect(matched(fragment)).toEqual(["турецком"]);
  });

  test("пересекающиеся выделения сливаются", () => {
    const fragment = blockFragment(
      "Гласную выбирает гармония.",
      "гарм армония",
    );

    expect(fragment).toEqual([
      { text: "Гласную выбирает ", matched: false },
      { text: "гармония", matched: true },
      { text: ".", matched: false },
    ]);
  });

  test("соседние выделения сливаются", () => {
    const fragment = blockFragment("Пишут kitapta.", "kitap ta.");

    expect(matched(fragment)).toEqual(["kitapta."]);
  });
});

describe("адрес строки", () => {
  test("тема найдена по названию или сути: адрес окна темы на карте", () => {
    expect(row(searchIndex, "местный", "locative-da").href).toBe(
      "/?topic=locative-da",
    );
    expect(row(searchIndex, "движение", "dative-a").href).toBe(
      "/?topic=dative-a",
    );
  });

  test("совпадение в примере: окно темы открывается на блоке «Примеры»", () => {
    expect(row(scenarioIndex, "geliyorum", "particle-da").href).toBe(
      "/?topic=particle-da#block-examples",
    );
  });

  test("совпадение в блоке статьи: окно темы открывается на этом блоке", () => {
    expect(row(scenarioIndex, "оглушается", "particle-da").href).toBe(
      "/?topic=particle-da#block-pitfalls",
    );
    expect(row(searchIndex, "предлог", "locative-da").href).toBe(
      "/?topic=locative-da#block-vs_russian",
    );
  });
});
