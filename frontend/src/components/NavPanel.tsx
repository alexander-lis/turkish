import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { NavLink } from "react-router";
import { topicMapQuery, type TopicMap } from "../api/queries.ts";
import { cx } from "../lib/cx.ts";
import {
  groupByLevel,
  groupBySection,
  type TopicGroup,
} from "../lib/grouping.ts";
import { NOTATION_PATH, topicPath } from "../lib/site.ts";
import { AffixText } from "./AffixText.tsx";
import { QueryView } from "./QueryView.tsx";
import { StubMark } from "./StubMark.tsx";

type Grouping = "path" | "sections";

const GROUPINGS: Record<Grouping, string> = {
  path: "По маршруту",
  sections: "По разделам",
};

const STORAGE_KEY = "nav-grouping";

function readGrouping(): Grouping {
  try {
    return localStorage.getItem(STORAGE_KEY) === "sections"
      ? "sections"
      : "path";
  } catch {
    // Хранилище недоступно, например в приватном режиме: берём вид по умолчанию.
    return "path";
  }
}

function storeGrouping(grouping: Grouping): void {
  try {
    localStorage.setItem(STORAGE_KEY, grouping);
  } catch {
    // Выбор не переживёт перезагрузку, но панель продолжит работать.
  }
}

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return cx(
    "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm",
    isActive
      ? "bg-red-50 font-medium text-red-800"
      : "text-slate-700 hover:bg-slate-100",
  );
}

function scrollIntoViewIfCurrent(link: HTMLAnchorElement | null): void {
  if (link?.getAttribute("aria-current") === "page") {
    link.scrollIntoView({ block: "nearest" });
  }
}

function TopicGroups({ groups }: { groups: TopicGroup[] }) {
  return groups.map((group) => (
    <section key={group.key} aria-labelledby={`nav-group-${group.key}`}>
      <h2
        id={`nav-group-${group.key}`}
        className="sticky top-0 bg-white px-2 pt-4 pb-1 text-xs font-semibold tracking-wide text-slate-500"
      >
        {group.title}
      </h2>
      <ul>
        {group.topics.map((topic) => (
          <li key={topic.id}>
            <NavLink
              to={topicPath(topic.id)}
              className={navLinkClass}
              ref={scrollIntoViewIfCurrent}
            >
              <span className={cx(topic.is_stub && "text-slate-500")}>
                <AffixText>{topic.title}</AffixText>
              </span>
              {topic.is_stub && <StubMark />}
            </NavLink>
          </li>
        ))}
      </ul>
    </section>
  ));
}

function groupTopics(map: TopicMap, grouping: Grouping): TopicGroup[] {
  return grouping === "path"
    ? groupByLevel(map.topics)
    : groupBySection(map.topics, map.sections);
}

/** Панель навигации: все темы в одной из двух группировок и ссылка на «Обозначения». */
export function NavPanel() {
  const [grouping, setGrouping] = useState<Grouping>(readGrouping);
  const topicMap = useQuery(topicMapQuery);

  function choose(next: Grouping) {
    setGrouping(next);
    storeGrouping(next);
  }

  return (
    <nav aria-label="Темы справочника" className="flex h-full flex-col">
      <div className="space-y-3 border-b border-slate-200 p-3">
        <NavLink to={NOTATION_PATH} className={navLinkClass}>
          Обозначения
        </NavLink>
        <div
          role="group"
          aria-label="Группировка тем"
          className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 text-sm"
        >
          {(Object.keys(GROUPINGS) as Grouping[]).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={grouping === option}
              onClick={() => choose(option)}
              className={cx(
                "rounded-md px-2 py-1",
                grouping === option
                  ? "bg-white font-medium text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              {GROUPINGS[option]}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6">
        <QueryView query={topicMap}>
          {(map) => <TopicGroups groups={groupTopics(map, grouping)} />}
        </QueryView>
      </div>
    </nav>
  );
}
