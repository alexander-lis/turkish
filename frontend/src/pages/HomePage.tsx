import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { topicMapQuery, type TopicMap } from "../api/queries.ts";
import { AffixText } from "../components/AffixText.tsx";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";
import { StubMark } from "../components/StubMark.tsx";
import { groupByLevel } from "../lib/grouping.ts";
import { topicPath } from "../lib/site.ts";

function LearningPath({ topics, sections }: TopicMap) {
  const sectionTitles = new Map(
    sections.map((section) => [section.id, section.title]),
  );

  return groupByLevel(topics).map((group) => (
    <section
      key={group.key}
      aria-labelledby={`level-${group.key}`}
      className="mt-8"
    >
      <h2
        id={`level-${group.key}`}
        className="flex items-baseline gap-2 text-xl font-semibold tracking-tight"
      >
        {group.title}
        <span className="text-sm font-normal text-slate-500">
          тем: {group.topics.length}
        </span>
      </h2>
      <ol className="mt-3 divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {group.topics.map((topic) => (
          <li key={topic.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Link
                to={topicPath(topic.id)}
                className="font-medium text-slate-900 hover:text-red-700 hover:underline"
              >
                <AffixText>{topic.title}</AffixText>
              </Link>
              {topic.is_stub && <StubMark />}
              <span className="ml-auto text-xs text-slate-500">
                {sectionTitles.get(topic.section_id)}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              <AffixText>{topic.summary}</AffixText>
            </p>
          </li>
        ))}
      </ol>
    </section>
  ));
}

/** Главная страница: учебный маршрут по уровням. */
export function HomePage() {
  const topicMap = useQuery(topicMapQuery);

  return (
    <>
      <PageTitle />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Учебный маршрут
      </h1>
      <p className="mt-2 text-slate-600">
        Грамматика турецкого от A1 до B2. Темы идут в рекомендуемом порядке:
        каждая опирается на предыдущие.
      </p>
      <QueryView query={topicMap}>
        {(map) => <LearningPath {...map} />}
      </QueryView>
    </>
  );
}
