import type {
  Notation,
  Section,
  TopicDetail,
  TopicRef,
  TopicSummary,
} from "../api/types.ts";

/** Разделы идут не в том порядке, в каком их темы встречаются в маршруте. */
export const sections: Section[] = [
  { id: "nouns", title: "Существительное" },
  { id: "phonetics", title: "Фонетика и письмо" },
  { id: "verbs", title: "Времена глагола" },
];

/**
 * Учебный маршрут: темы всех четырёх уровней, написанные и заглушки.
 * Обзоров два: написанный «Обзор падежей» и заглушка «Обзор времён».
 */
export const topics: TopicSummary[] = [
  {
    id: "vowel-harmony",
    title: "Гармония гласных",
    level: "A1",
    section_id: "phonetics",
    summary: "Гласная аффикса подстраивается под последнюю гласную слова.",
    is_stub: false,
    is_overview: false,
  },
  {
    id: "plural-lar",
    title: "Множественное число -lAr",
    level: "A1",
    section_id: "nouns",
    summary: "Показывает, что предметов несколько.",
    is_stub: false,
    is_overview: false,
  },
  {
    id: "cases-overview",
    title: "Обзор падежей",
    level: "A1",
    section_id: "nouns",
    summary: "Падежи и их основные вопросы.",
    is_stub: false,
    is_overview: true,
  },
  {
    id: "dative-a",
    title: "Дательный падеж -(y)A",
    level: "A1",
    section_id: "nouns",
    summary: "Показывает, куда направлено движение.",
    is_stub: true,
    is_overview: false,
  },
  {
    id: "locative-da",
    title: "Местный падеж -DA",
    level: "A1",
    section_id: "nouns",
    summary: "Показывает, где что-то находится.",
    is_stub: false,
    is_overview: false,
  },
  {
    id: "past-di",
    title: "Прошедшее время -DI",
    level: "A2",
    section_id: "verbs",
    summary: "Действие, которое говорящий видел сам.",
    is_stub: true,
    is_overview: false,
  },
  {
    id: "past-mis",
    title: "Прошедшее время -mIş",
    level: "A2",
    section_id: "verbs",
    summary: "Действие, о котором говорящий узнал с чужих слов.",
    is_stub: true,
    is_overview: false,
  },
  {
    id: "tense-overview",
    title: "Обзор времён",
    level: "A2",
    section_id: "verbs",
    summary: "Простые времена рядом.",
    is_stub: true,
    is_overview: true,
  },
  {
    id: "passive-il",
    title: "Страдательный залог -Il",
    level: "B1",
    section_id: "verbs",
    summary: "Действие без указания того, кто его совершает.",
    is_stub: true,
    is_overview: false,
  },
  {
    id: "ablative-dan",
    title: "Исходный падеж -DAn",
    level: "B2",
    section_id: "nouns",
    summary: "Показывает, откуда начинается движение.",
    is_stub: true,
    is_overview: false,
  },
];

export function ref(id: string): TopicRef {
  const topic = topics.find((candidate) => candidate.id === id);
  if (!topic) {
    throw new Error(`В тестовых данных нет темы ${id}`);
  }
  return { id: topic.id, title: topic.title, is_stub: topic.is_stub };
}

type Article = Pick<TopicDetail, "blocks" | "examples">;
type Links = Pick<
  TopicDetail,
  "prerequisites" | "overviews" | "members" | "contrasts" | "related"
>;

/** Тема целиком. Связи, которых у темы нет, можно не называть. */
function detail(id: string, rest: Article & Partial<Links>): TopicDetail {
  const index = topics.findIndex((candidate) => candidate.id === id);
  const summary = topics[index];
  const section = sections.find(
    (candidate) => candidate.id === summary?.section_id,
  );
  if (!summary || !section) {
    throw new Error(`В тестовых данных нет темы ${id} или её раздела`);
  }
  const previous = topics[index - 1];
  const next = topics[index + 1];
  return {
    ...summary,
    section,
    prerequisites: [],
    overviews: [],
    members: [],
    contrasts: [],
    related: [],
    ...rest,
    previous: previous ? ref(previous.id) : null,
    next: next ? ref(next.id) : null,
  };
}

/** Первая тема маршрута: без пререквизитов и без части блоков. */
const vowelHarmony = detail("vowel-harmony", {
  blocks: [
    {
      kind: "formula",
      markdown: "Смотрим на **последнюю гласную** слова.",
    },
    {
      kind: "pitfalls",
      markdown: "Заимствованные слова бывают исключениями.",
    },
  ],
  examples: [
    {
      tr: { text: "evler", segments: [{ text: "evler", emphasized: false }] },
      ru: { text: "дома", segments: [{ text: "дома", emphasized: false }] },
      source: "authored",
      note: null,
      gloss: null,
    },
  ],
});

/** Написанный обзор: темы обзора идут в порядке контента, а не учебного маршрута. */
const casesOverview = detail("cases-overview", {
  blocks: [
    {
      kind: "formula",
      markdown: "Падеж выбирают по вопросу, на который отвечает слово.",
    },
  ],
  examples: [
    {
      tr: { text: "evde", segments: [{ text: "evde", emphasized: false }] },
      ru: { text: "дома", segments: [{ text: "дома", emphasized: false }] },
      source: "authored",
      note: null,
      gloss: null,
    },
  ],
  prerequisites: [ref("vowel-harmony")],
  members: [ref("locative-da"), ref("dative-a"), ref("ablative-dan")],
});

/**
 * Тема со всеми блоками шаблона: пререквизит, обзор, различение, разобранное в ней самой,
 * связанная тема и разные примеры.
 */
export const locativeDa = detail("locative-da", {
  blocks: [
    {
      kind: "formula",
      markdown:
        "Основа + **-DA**. Гласную выбирает [гармония гласных](topic:vowel-harmony).",
    },
    {
      kind: "forms",
      markdown:
        "| После | Аффикс | Пример |\n| --- | --- | --- |\n| a, ı, o, u | -da | okulda |\n| e, i, ö, ü | -de | evde |",
    },
    {
      kind: "pitfalls",
      markdown: "Частица *da* пишется отдельно.",
    },
    {
      kind: "vs_russian",
      markdown: "В русском место выражает предлог с падежом.",
    },
  ],
  examples: [
    {
      tr: {
        text: "Evdeyim.",
        segments: [
          { text: "Ev", emphasized: false },
          { text: "de", emphasized: true },
          { text: "yim.", emphasized: false },
        ],
      },
      ru: {
        text: "Я дома.",
        segments: [
          { text: "Я ", emphasized: false },
          { text: "дома", emphasized: true },
          { text: ".", emphasized: false },
        ],
      },
      source: "authored",
      note: "Последняя гласная слова — e.",
      gloss: null,
    },
    {
      tr: {
        text: "Evlerimde.",
        segments: [{ text: "Evlerimde.", emphasized: false }],
      },
      ru: {
        text: "В моих домах.",
        segments: [{ text: "В моих домах.", emphasized: false }],
      },
      source: "authored",
      note: null,
      gloss: [
        {
          morphemes: [
            {
              form: "ev",
              gloss: "дом",
              parts: [{ text: "дом", is_abbreviation: false }],
            },
            {
              form: "ler",
              gloss: "МН",
              parts: [{ text: "МН", is_abbreviation: true }],
            },
            {
              form: "im",
              gloss: "1ЕД.ПРИТ",
              parts: [
                { text: "1ЕД", is_abbreviation: true },
                { text: "ПРИТ", is_abbreviation: true },
              ],
            },
            {
              form: "de",
              gloss: "МЕСТ",
              parts: [{ text: "МЕСТ", is_abbreviation: true }],
            },
          ],
        },
      ],
    },
    {
      tr: {
        text: "Okuldayız.",
        segments: [{ text: "Okuldayız.", emphasized: false }],
      },
      ru: {
        text: "Мы в школе.",
        segments: [{ text: "Мы в школе.", emphasized: false }],
      },
      source: "generated",
      note: null,
      gloss: null,
    },
  ],
  prerequisites: [ref("vowel-harmony")],
  overviews: [ref("cases-overview")],
  contrasts: [
    {
      title: "«Где» и «куда»: -DA и -(y)A",
      topics: [ref("dative-a")],
      explained_in: [ref("locative-da")],
    },
  ],
  related: [ref("ablative-dan")],
});

/** Заглушка, на которую ведёт различение темы locative-da. */
const dativeA = detail("dative-a", {
  blocks: [],
  examples: [],
  overviews: [ref("cases-overview")],
  contrasts: [
    {
      title: "«Где» и «куда»: -DA и -(y)A",
      topics: [ref("locative-da")],
      explained_in: [ref("locative-da")],
    },
  ],
});

/** Заглушка в середине маршрута: входит в обзор, а её различение разобрано в другой теме. */
const pastDi = detail("past-di", {
  blocks: [],
  examples: [],
  prerequisites: [ref("vowel-harmony")],
  overviews: [ref("tense-overview")],
  contrasts: [
    {
      title: "-DI и -mIş",
      topics: [ref("past-mis")],
      explained_in: [ref("tense-overview")],
    },
  ],
  related: [ref("passive-il")],
});

/** Обзор-заглушка. */
const tenseOverview = detail("tense-overview", {
  blocks: [],
  examples: [],
  prerequisites: [ref("past-di"), ref("past-mis")],
  members: [ref("past-di"), ref("past-mis")],
});

/** Последняя тема маршрута. */
const ablativeDan = detail("ablative-dan", {
  blocks: [],
  examples: [],
});

export const topicDetails: Record<string, TopicDetail> = {
  [vowelHarmony.id]: vowelHarmony,
  [casesOverview.id]: casesOverview,
  [dativeA.id]: dativeA,
  [locativeDa.id]: locativeDa,
  [pastDi.id]: pastDi,
  [tenseOverview.id]: tenseOverview,
  [ablativeDan.id]: ablativeDan,
};

export const notation: Notation = {
  intro_markdown: "Заглавная буква в формуле аффикса — **чередующийся звук**.",
  abbreviations: [
    { code: "МН", meaning: "множественное число" },
    { code: "МЕСТ", meaning: "местный падеж" },
    { code: "1ЕД", meaning: "первое лицо единственного числа" },
  ],
};
