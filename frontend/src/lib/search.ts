import type { BlockKind, SearchTopic } from "../api/types.ts";
import { expandAffixFormula, isAffixFormula } from "./affixFormula.ts";
import { foldText, queryWords, trimHyphens } from "./searchFold.ts";
import { mapTopicBlockPath, mapTopicPath } from "./site.ts";

/** Столько тем показывает список; остальные только считаются. */
const RESULT_LIMIT = 20;
/** В сути, примерах и тексте статьи ищутся слова от двух символов. */
const MIN_TEXT_WORD = 2;
/** Строка длиннее показывается окном вокруг первого совпадения. */
const FRAGMENT_LENGTH = 120;
/** Столько символов окно оставляет перед первым совпадением. */
const CONTEXT_BEFORE = 40;

/**
 * Слово названия вместе со знаками, которые бывают внутри слова и формулы аффикса:
 * по ним формула отличается от слова.
 */
const TITLE_WORD = /[\p{L}\p{N}'’()/-]+/gu;

/**
 * Где слово запроса совпало с темой, от лучшего к худшему: слово названия или вариант
 * формулы аффикса равны слову запроса (1), начинаются с него (2), содержат его (3);
 * суть (4); пример (5); текст блока статьи (6).
 */
type Stage = 1 | 2 | 3 | 4 | 5 | 6;

/** Текст и он же после свёртки: место совпадения в них одно. */
interface Line {
  text: string;
  folded: string;
}

interface PreparedExample {
  tr: Line;
  ru: Line;
  note: Line | null;
}

interface BlockLine extends Line {
  kind: BlockKind;
}

/** Слово названия на своём месте: по нему название и ищется, и выделяется. */
interface TitleWord {
  start: number;
  end: number;
  /** Формула аффикса совпадает любым своим вариантом, а выделяется целиком. */
  formula: boolean;
  /** Свёрнутые формы: сама запись и, у формулы, все её варианты. */
  forms: readonly string[];
}

interface PreparedTopic {
  topic: SearchTopic;
  title: Line;
  titleWords: readonly TitleWord[];
  summary: Line;
  examples: readonly PreparedExample[];
  /** Строки всех блоков статьи по порядку. */
  lines: readonly BlockLine[];
}

/** Поисковый индекс, свёрнутый для сравнения. */
export type PreparedIndex = readonly PreparedTopic[];

/** Отрезок фрагмента: текст и то, совпал ли он с запросом. */
interface FragmentPart {
  text: string;
  matched: boolean;
}

export type Fragment = readonly FragmentPart[];

/** Место совпадения, которое показывает строка результата. */
type MatchPlace =
  | { kind: "title" }
  | { kind: "summary"; fragment: Fragment }
  | {
      kind: "example";
      tr: Fragment;
      /** Перевод, а если совпало только примечание — оно. */
      ru: Fragment;
    }
  | { kind: "block"; block: BlockKind; fragment: Fragment };

export interface FoundTopic {
  topic: SearchTopic;
  /** Название темы с выделенными совпадениями. */
  title: Fragment;
  place: MatchPlace;
  /** Окно темы на карте; если совпал пример или блок статьи — открытое на этом блоке. */
  href: string;
}

export interface SearchResult {
  /** Найденные темы по порядку результатов, не больше двадцати. */
  topics: FoundTopic[];
  /** Сколько тем найдено всего. */
  total: number;
}

function line(text: string): Line {
  return { text, folded: foldText(text) };
}

/** Слова названия: сама запись и, если это формула аффикса, все её варианты. */
function titleWords(title: string): TitleWord[] {
  return [...title.matchAll(TITLE_WORD)].map((match) => {
    const [word] = match;
    const formula = isAffixFormula(word);
    const written = formula ? [word, ...expandAffixFormula(word)] : [word];
    const forms = new Set(written.map((form) => trimHyphens(foldText(form))));
    forms.delete("");
    return {
      start: match.index,
      end: match.index + word.length,
      formula,
      forms: [...forms],
    };
  });
}

/** Свернуть индекс один раз: поиск на каждую букву идёт по готовым строкам. */
export function prepareIndex(index: readonly SearchTopic[]): PreparedIndex {
  return index.map((topic) => ({
    topic,
    title: line(topic.title),
    titleWords: titleWords(topic.title),
    summary: line(topic.summary),
    examples: topic.examples.map((example) => ({
      tr: line(example.tr),
      ru: line(example.ru),
      note: example.note === null ? null : line(example.note),
    })),
    lines: topic.blocks.flatMap((block) =>
      block.lines.map((text) => ({ kind: block.kind, ...line(text) })),
    ),
  }));
}

function has(text: Line, word: string): boolean {
  return text.folded.includes(word);
}

function exampleHas(example: PreparedExample, word: string): boolean {
  return (
    has(example.tr, word) ||
    has(example.ru, word) ||
    (example.note !== null && has(example.note, word))
  );
}

function wordStage(topic: PreparedTopic, word: string): Stage | null {
  let stage: Stage | null = null;
  for (const titleWord of topic.titleWords) {
    for (const form of titleWord.forms) {
      if (form === word) {
        return 1;
      }
      if (form.startsWith(word)) {
        stage = 2;
      } else if (stage === null && form.includes(word)) {
        stage = 3;
      }
    }
  }
  if (stage !== null || word.length < MIN_TEXT_WORD) {
    return stage;
  }
  if (has(topic.summary, word)) {
    return 4;
  }
  if (topic.examples.some((example) => exampleHas(example, word))) {
    return 5;
  }
  if (topic.lines.some((blockLine) => has(blockLine, word))) {
    return 6;
  }
  return null;
}

interface Match {
  topic: PreparedTopic;
  /** Ступень темы — худшая из ступеней слов запроса. */
  stage: Stage;
  /** Слово, которое определило ступень темы. */
  decisive: string;
}

/** Совпадение темы с запросом или null, если хотя бы одного слова в теме нет. */
function matchTopic(
  topic: PreparedTopic,
  words: readonly string[],
): Match | null {
  let match: Match | null = null;
  for (const word of words) {
    const stage = wordStage(topic, word);
    if (stage === null) {
      return null;
    }
    if (match === null || stage > match.stage) {
      match = { topic, stage, decisive: word };
    }
  }
  return match;
}

type Range = [start: number, end: number];

/** Все вхождения слов в строку, со сдвигом на место строки в тексте. */
function occurrences(
  folded: string,
  words: readonly string[],
  offset = 0,
): Range[] {
  const found: Range[] = [];
  for (const word of words) {
    let at = folded.indexOf(word);
    while (at !== -1) {
      found.push([offset + at, offset + at + word.length]);
      at = folded.indexOf(word, at + word.length);
    }
  }
  return found;
}

/** Отрезки по порядку; пересекающиеся и соседние слиты. */
function mergeRanges(ranges: readonly Range[]): Range[] {
  const merged: Range[] = [];
  for (const [start, end] of ranges.toSorted((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last !== undefined && start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/**
 * Какую часть строки показать: строку целиком, а если она длинная — окно вокруг совпадения
 * от start до end. Окно не начинается и не кончается посреди слова.
 */
function fragmentWindow(text: string, start: number, end: number): Range {
  if (text.length <= FRAGMENT_LENGTH) {
    return [0, text.length];
  }
  let to = Math.min(
    text.length,
    Math.max(0, start - CONTEXT_BEFORE) + FRAGMENT_LENGTH,
  );
  let from = Math.max(0, to - FRAGMENT_LENGTH);
  if (from > 0) {
    const space = text.indexOf(" ", from - 1);
    if (space !== -1 && space < start) {
      from = space + 1;
    }
  }
  if (to < text.length) {
    const space = text.lastIndexOf(" ", to);
    if (space >= end && space > from) {
      to = space;
    }
  }
  return [from, to];
}

function addPart(parts: FragmentPart[], text: string, matched: boolean): void {
  if (text === "") {
    return;
  }
  const last = parts.at(-1);
  if (last?.matched === matched) {
    last.text += text;
  } else {
    parts.push({ text, matched });
  }
}

/** Текст от from до to отрезками: выделены части, которые попали в ranges. */
function highlight(
  text: string,
  ranges: readonly Range[],
  from = 0,
  to = text.length,
): Fragment {
  const parts: FragmentPart[] = [];
  addPart(parts, from > 0 ? "…" : "", false);
  let at = from;
  for (const [start, end] of ranges) {
    const visibleStart = Math.max(start, at);
    const visibleEnd = Math.min(end, to);
    if (visibleStart < visibleEnd) {
      addPart(parts, text.slice(at, visibleStart), false);
      addPart(parts, text.slice(visibleStart, visibleEnd), true);
      at = visibleEnd;
    }
  }
  addPart(parts, text.slice(at, to), false);
  addPart(parts, to < text.length ? "…" : "", false);
  return parts;
}

/** Фрагмент строки с выделенными вхождениями слов запроса. */
function fragment({ text, folded }: Line, words: readonly string[]): Fragment {
  const ranges = mergeRanges(occurrences(folded, words));
  const [from, to] = fragmentWindow(
    text,
    ranges[0]?.[0] ?? 0,
    ranges[0]?.[1] ?? 0,
  );
  return highlight(text, ranges, from, to);
}

/**
 * Название с выделенными совпадениями. В обычном слове выделяется само вхождение.
 * Формула аффикса выделяется целиком: запрос совпадает с её вариантом, а не с записью,
 * и показать в названии можно только то, какая формула его дала.
 */
function highlightedTitle(
  { title, titleWords }: PreparedTopic,
  words: readonly string[],
): Fragment {
  const ranges = titleWords.flatMap(({ start, end, formula, forms }) => {
    if (!formula) {
      return occurrences(title.folded.slice(start, end), words, start);
    }
    const matched = words.some((word) =>
      forms.some((form) => form.includes(word)),
    );
    return matched ? [[start, end] satisfies Range] : [];
  });
  return highlight(title.text, mergeRanges(ranges));
}

/**
 * Первая строка, в которой есть все слова запроса, а если такой нет — первая со словом,
 * которое определило ступень темы.
 */
function pickLine<T>(
  lines: readonly T[],
  lineHas: (candidate: T, word: string) => boolean,
  words: readonly string[],
  decisive: string,
): T | undefined {
  return (
    lines.find((candidate) =>
      words.every((word) => lineHas(candidate, word)),
    ) ?? lines.find((candidate) => lineHas(candidate, decisive))
  );
}

/** Строка результата: место совпадения задаёт ступень темы. */
function foundTopic(match: Match, words: readonly string[]): FoundTopic {
  const { topic: prepared, stage, decisive } = match;
  const { topic } = prepared;
  // Слово из одного символа в текстах не ищется, поэтому и не выделяется.
  const textWords = words.filter((word) => word.length >= MIN_TEXT_WORD);
  const title = highlightedTitle(prepared, words);

  if (stage === 4) {
    return {
      topic,
      title,
      place: {
        kind: "summary",
        fragment: fragment(prepared.summary, textWords),
      },
      href: mapTopicPath(topic.id),
    };
  }
  if (stage === 5) {
    const example = pickLine(
      prepared.examples,
      exampleHas,
      textWords,
      decisive,
    );
    if (example !== undefined) {
      const onlyNote = !textWords.some(
        (word) => has(example.tr, word) || has(example.ru, word),
      );
      return {
        topic,
        title,
        place: {
          kind: "example",
          tr: fragment(example.tr, textWords),
          ru: fragment(
            onlyNote && example.note !== null ? example.note : example.ru,
            textWords,
          ),
        },
        href: mapTopicBlockPath(topic.id, "examples"),
      };
    }
  }
  if (stage === 6) {
    const blockLine = pickLine(prepared.lines, has, textWords, decisive);
    if (blockLine !== undefined) {
      return {
        topic,
        title,
        place: {
          kind: "block",
          block: blockLine.kind,
          fragment: fragment(blockLine, textWords),
        },
        href: mapTopicBlockPath(topic.id, blockLine.kind),
      };
    }
  }
  return {
    topic,
    title,
    place: { kind: "title" },
    href: mapTopicPath(topic.id),
  };
}

/**
 * Найти темы по запросу. Каждое слово запроса ищется отдельно; тема без хотя бы одного
 * слова не находится. Порядок — по ступени темы, при равенстве — по месту в учебном
 * маршруте, то есть по порядку записей индекса.
 */
export function searchTopics(
  index: PreparedIndex,
  query: string,
): SearchResult {
  const words = queryWords(query);
  if (words.length === 0) {
    return { topics: [], total: 0 };
  }
  const matches = index
    .map((topic) => matchTopic(topic, words))
    .filter((match) => match !== null);
  // Сортировка устойчивая: темы одной ступени остаются в порядке индекса.
  matches.sort((first, second) => first.stage - second.stage);
  return {
    topics: matches
      .slice(0, RESULT_LIMIT)
      .map((match) => foundTopic(match, words)),
    total: matches.length,
  };
}
