import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { searchIndexQuery } from "../api/queries.ts";
import {
  prepareIndex,
  searchTopics,
  type FoundTopic,
  type Fragment,
} from "../lib/search.ts";
import { queryWords } from "../lib/searchFold.ts";
import { TEMPLATE } from "../lib/template.ts";
import { AffixText } from "./AffixText.tsx";
import { LevelBadge } from "./LevelBadge.tsx";
import { QueryView } from "./QueryView.tsx";
import { SearchDialog, type SearchRow } from "./SearchDialog.tsx";
import { StubMark } from "./TopicMarks.tsx";

interface TopicRow extends SearchRow {
  found: FoundTopic;
}

const MARK_CLASS = "rounded-sm bg-amber-200/70 text-inherit";

function Highlighted({ fragment }: { fragment: Fragment }) {
  return fragment.map((part, index) =>
    part.matched ? (
      <mark key={index} className={MARK_CLASS}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
}

/** Название темы с выделением: формула аффикса не рвётся при переносе и здесь. */
function Title({ fragment }: { fragment: Fragment }) {
  return fragment.map((part, index) =>
    part.matched ? (
      <mark key={index} className={MARK_CLASS}>
        <AffixText>{part.text}</AffixText>
      </mark>
    ) : (
      <AffixText key={index}>{part.text}</AffixText>
    ),
  );
}

/** Фрагмент текста с подписью, откуда он: суть, пример или блок статьи. */
function Snippet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="mt-0.5 line-clamp-2 block text-sm text-slate-600">
      <span className="mr-1.5 text-xs font-medium text-slate-500">{label}</span>
      {children}
    </span>
  );
}

/** Место совпадения: раздел, если совпало название, иначе фрагмент с подписью. */
function Place({ found }: { found: FoundTopic }) {
  const { place } = found;
  switch (place.kind) {
    case "title":
      return (
        <span className="mt-0.5 block truncate text-sm text-slate-500">
          {found.topic.section_title}
        </span>
      );
    case "summary":
      return (
        <Snippet label="Суть">
          <Highlighted fragment={place.fragment} />
        </Snippet>
      );
    case "example":
      return (
        <Snippet label="Пример">
          <span lang="tr" className="font-medium text-slate-800">
            <Highlighted fragment={place.tr} />
          </span>
          {" — "}
          <Highlighted fragment={place.ru} />
        </Snippet>
      );
    case "block":
      return (
        <Snippet label={TEMPLATE[place.block]}>
          <Highlighted fragment={place.fragment} />
        </Snippet>
      );
  }
}

function TopicRowView({ found }: { found: FoundTopic }) {
  const { topic } = found;
  return (
    <>
      <span className="flex items-center gap-2">
        <span className="min-w-0 font-medium text-slate-900">
          <Title fragment={found.title} />
        </span>
        {topic.is_stub && <StubMark />}
        <span className="ml-auto shrink-0">
          <LevelBadge level={topic.level} />
        </span>
      </span>
      <Place found={found} />
    </>
  );
}

/** Что можно искать: вид запроса, пояснение и примеры, которые подставляются нажатием. */
const HINTS = [
  {
    glyph: "Аа",
    title: "Название темы",
    note: "целиком или частью слова",
    samples: ["местный падеж", "обзор времён"],
  },
  {
    glyph: "-A",
    title: "Аффикс",
    note: "в любом варианте: -de найдёт -DA",
    samples: ["-de", "ecek", "mış"],
  },
  {
    glyph: "«»",
    title: "Слово из примера или статьи",
    note: "турецкое или русское",
    samples: ["geliyorum", "оглушается"],
  },
  {
    glyph: "ç",
    title: "Без диакритики и регистра",
    note: "cunku найдёт çünkü",
    samples: ["cunku", "hala"],
  },
] as const;

/** Подсказка при пустом запросе: что можно искать, с примерами запросов. */
function Hint({ onPick }: { onPick: (query: string) => void }) {
  return (
    <div className="py-3">
      <p className="px-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">
        Что можно искать
      </p>
      <ul className="mt-1">
        {HINTS.map((hint) => (
          <li
            key={hint.title}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 px-1 py-2.5"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-50 text-sm font-semibold text-red-700 ring-1 ring-red-100"
            >
              {hint.glyph}
            </span>
            <span className="min-w-0 flex-1 basis-44">
              <span className="block font-medium text-slate-900">
                {hint.title}
              </span>
              <span className="block text-sm text-slate-500">{hint.note}</span>
            </span>
            <span className="flex flex-wrap gap-1.5 max-sm:basis-full max-sm:pl-13">
              {hint.samples.map((sample) => (
                <button
                  key={sample}
                  type="button"
                  // Пример — подспорье для мыши и касания: фокус остаётся в поле запроса,
                  // и после нажатия запрос можно править дальше.
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onPick(sample)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 shadow-xs hover:border-red-200 hover:bg-red-50 hover:text-red-800"
                >
                  {sample}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NothingFound() {
  return (
    <div className="px-1 py-10 text-center">
      <p className="font-medium text-slate-900">Ничего не найдено</p>
      <p className="mt-1 text-sm text-slate-500">
        Попробуйте часть слова или другой вариант аффикса.
      </p>
    </div>
  );
}

const NOTHING_FOUND: { rows: TopicRow[]; total: number } = {
  rows: [],
  total: 0,
};

interface TopicSearchProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Поиск тем: связывает окно поиска с поисковым индексом и правилами поиска. Хранит запрос,
 * грузит индекс, когда окно открыто, превращает найденные темы в строки окна и решает,
 * куда ведёт выбор строки.
 */
export function TopicSearch({ open, onClose }: TopicSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  // Запрос не переживает закрытие окна, чем бы его ни закрыли.
  if (!open && query !== "") {
    setQuery("");
  }

  const index = useQuery({ ...searchIndexQuery, enabled: open });
  const prepared = useMemo(
    () => (index.data === undefined ? null : prepareIndex(index.data)),
    [index.data],
  );
  const { rows, total } = useMemo(() => {
    if (prepared === null) {
      return NOTHING_FOUND;
    }
    const result = searchTopics(prepared, query);
    return {
      rows: result.topics.map((found): TopicRow => ({
        id: found.topic.id,
        href: found.href,
        found,
      })),
      total: result.total,
    };
  }, [prepared, query]);

  const hasQuery = queryWords(query).length > 0;
  let summary = "";
  if (hasQuery && prepared !== null) {
    summary =
      total > rows.length
        ? `Найдено тем: ${total}, показаны первые ${rows.length}`
        : `Найдено тем: ${total}`;
  }

  return (
    <SearchDialog
      open={open}
      onClose={onClose}
      label="Поиск по темам"
      placeholder="Название, аффикс или слово"
      query={query}
      onQueryChange={setQuery}
      rows={rows}
      renderRow={(row) => <TopicRowView found={row.found} />}
      onSelect={(row, target) => {
        if (target === "new-tab") {
          // Окно остаётся открытым: из одного списка открывают несколько тем подряд.
          window.open(row.href, "_blank", "noopener");
          return;
        }
        void navigate(row.href);
        onClose();
      }}
      status={
        <QueryView query={index}>
          {() => (hasQuery ? <NothingFound /> : <Hint onPick={setQuery} />)}
        </QueryView>
      }
      summary={summary}
    />
  );
}
