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

/** Учебный маршрут: по теме на каждый уровень сверх A1, две заглушки и три написанные темы. */
export const topics: TopicSummary[] = [
  {
    id: "vowel-harmony",
    title: "Гармония гласных",
    level: "A1",
    section_id: "phonetics",
    summary: "Гласная аффикса подстраивается под последнюю гласную слова.",
    is_stub: false,
  },
  {
    id: "plural-lar",
    title: "Множественное число -lAr",
    level: "A1",
    section_id: "nouns",
    summary: "Показывает, что предметов несколько.",
    is_stub: false,
  },
  {
    id: "locative-da",
    title: "Местный падеж -DA",
    level: "A1",
    section_id: "nouns",
    summary: "Показывает, где что-то находится.",
    is_stub: false,
  },
  {
    id: "past-di",
    title: "Прошедшее время -DI",
    level: "A2",
    section_id: "verbs",
    summary: "Действие, которое говорящий видел сам.",
    is_stub: true,
  },
  {
    id: "passive-il",
    title: "Страдательный залог -Il",
    level: "B1",
    section_id: "verbs",
    summary: "Действие без указания того, кто его совершает.",
    is_stub: true,
  },
  {
    id: "ablative-dan",
    title: "Исходный падеж -DAn",
    level: "B2",
    section_id: "nouns",
    summary: "Показывает, откуда начинается движение.",
    is_stub: true,
  },
];

function ref(id: string): TopicRef {
  const topic = topics.find((candidate) => candidate.id === id);
  if (!topic) {
    throw new Error(`В тестовых данных нет темы ${id}`);
  }
  return { id: topic.id, title: topic.title, is_stub: topic.is_stub };
}

function detail(
  id: string,
  rest: Pick<TopicDetail, "blocks" | "examples" | "prerequisites" | "related">,
): TopicDetail {
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
  prerequisites: [],
  related: [],
});

/** Тема со всеми блоками шаблона, пререквизитом, связанной темой и разными примерами. */
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
  related: [ref("ablative-dan")],
});

/** Заглушка в середине маршрута. */
const pastDi = detail("past-di", {
  blocks: [],
  examples: [],
  prerequisites: [ref("vowel-harmony")],
  related: [],
});

/** Последняя тема маршрута. */
const ablativeDan = detail("ablative-dan", {
  blocks: [],
  examples: [],
  prerequisites: [],
  related: [],
});

export const topicDetails: Record<string, TopicDetail> = {
  [vowelHarmony.id]: vowelHarmony,
  [locativeDa.id]: locativeDa,
  [pastDi.id]: pastDi,
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
