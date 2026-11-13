import { useId } from "react";
import { Link } from "react-router";
import type { TopicSummary } from "../api/types.ts";
import type { TopicLinks } from "../lib/mapLinks.ts";
import { topicPath } from "../lib/site.ts";
import { AffixText } from "./AffixText.tsx";
import { LevelBadge } from "./LevelBadge.tsx";
import { OverviewMark, StubMark } from "./TopicMarks.tsx";

interface PanelProps {
  topic: TopicSummary;
  sectionTitle: string;
  links: TopicLinks;
  onSelect: (id: string) => void;
  onClose: () => void;
}

function TopicButton({
  topic,
  onSelect,
}: {
  topic: TopicSummary;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(topic.id)}
      className="max-w-full rounded text-left font-medium text-red-700 hover:underline"
    >
      <AffixText>{topic.title}</AffixText>
      {topic.is_stub && (
        <>
          {" "}
          <StubMark />
        </>
      )}
    </button>
  );
}

function TopicList({
  label,
  topics,
  onSelect,
}: {
  label: string;
  topics: TopicSummary[];
  onSelect: (id: string) => void;
}) {
  const labelId = useId();
  if (topics.length === 0) {
    return null;
  }
  return (
    <div>
      <p id={labelId} className="font-medium text-slate-600">
        {label}
      </p>
      <ul aria-labelledby={labelId} className="mt-1 space-y-1">
        {topics.map((topic) => (
          <li key={topic.id}>
            <TopicButton topic={topic} onSelect={onSelect} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Панель выбранной темы: суть, связи по видам и ссылка на страницу темы. */
export function MapTopicPanel({
  topic,
  sectionTitle,
  links,
  onSelect,
  onClose,
}: PanelProps) {
  const contrastsId = useId();
  return (
    <aside
      aria-label="Тема на карте"
      className="absolute inset-x-0 bottom-0 z-10 flex max-h-[50%] flex-col rounded-t-xl border-t border-slate-200 bg-white shadow-lg sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:max-h-none sm:w-80 sm:rounded-xl sm:border"
    >
      <div className="flex items-start gap-2 border-b border-slate-200 p-4">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <LevelBadge level={topic.level} />
            {sectionTitle}
          </p>
          <h2 className="mt-1.5 text-lg leading-snug font-semibold tracking-tight">
            <AffixText>{topic.title}</AffixText>
          </h2>
          {(topic.is_overview || topic.is_stub) && (
            <p className="mt-1 flex gap-1">
              {topic.is_overview && <OverviewMark />}
              {topic.is_stub && <StubMark />}
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Закрыть"
          onClick={onClose}
          className="-mt-1 -mr-1 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <path d="M5 5l10 10M15 5L5 15" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        <p className="text-base text-slate-700">
          <AffixText>{topic.summary}</AffixText>
        </p>
        <Link
          to={topicPath(topic.id)}
          className="inline-block font-medium text-red-700 hover:underline"
        >
          Открыть страницу темы →
        </Link>
        <TopicList
          label="Пререквизиты"
          topics={links.prerequisites}
          onSelect={onSelect}
        />
        <TopicList
          label="Нужна для"
          topics={links.requiredFor}
          onSelect={onSelect}
        />
        <TopicList
          label="Входит в обзор"
          topics={links.overviews}
          onSelect={onSelect}
        />
        <TopicList
          label="Темы обзора"
          topics={links.members}
          onSelect={onSelect}
        />
        {links.contrasts.length > 0 && (
          <div>
            <p id={contrastsId} className="font-medium text-slate-600">
              Не путать
            </p>
            <ul aria-labelledby={contrastsId} className="mt-1 space-y-2">
              {links.contrasts.map((contrast) => (
                <li key={contrast.title}>
                  <p className="text-slate-900">
                    <AffixText>{contrast.title}</AffixText>
                  </p>
                  <ul className="mt-0.5 space-y-1">
                    {contrast.topics.map((other) => (
                      <li key={other.id}>
                        <TopicButton topic={other} onSelect={onSelect} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}
        <TopicList
          label="Связанные темы"
          topics={links.related}
          onSelect={onSelect}
        />
      </div>
    </aside>
  );
}
