import { useQuery } from "@tanstack/react-query";
import { useId, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { isNotFound } from "../api/client.ts";
import { topicQuery } from "../api/queries.ts";
import type { TopicDetail, TopicRef } from "../api/types.ts";
import { AffixText } from "../components/AffixText.tsx";
import { ArticleMarkdown } from "../components/ArticleMarkdown.tsx";
import { ExampleCard } from "../components/ExampleCard.tsx";
import { LevelBadge } from "../components/LevelBadge.tsx";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";
import { StubMark } from "../components/TopicMarks.tsx";
import { NOTATION_PATH, topicPath } from "../lib/site.ts";
import {
  TEMPLATE,
  TEMPLATE_ORDER,
  type TemplateBlock,
} from "../lib/template.ts";
import { NotFoundPage } from "./NotFoundPage.tsx";

const LINK_CLASS = "font-medium text-red-700 hover:underline";

function TopicRefLink({ topic }: { topic: TopicRef }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <Link to={topicPath(topic.id)} className={LINK_CLASS}>
        <AffixText>{topic.title}</AffixText>
      </Link>
      {topic.is_stub && <StubMark />}
    </span>
  );
}

/** Список ссылок на темы с подписью: пререквизиты, обзоры темы, темы обзора. */
function TopicLinks({ label, topics }: { label: string; topics: TopicRef[] }) {
  const labelId = useId();
  if (topics.length === 0) {
    return null;
  }
  return (
    <div>
      <p id={labelId} className="font-medium text-slate-600">
        {label}
      </p>
      <ul
        aria-labelledby={labelId}
        className="mt-1 flex flex-wrap gap-x-4 gap-y-1"
      >
        {topics.map((topic) => (
          <li key={topic.id}>
            <TopicRefLink topic={topic} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Различения темы: что путают, с какими темами и где разбор, если он не на этой странице. */
function Contrasts({ topic }: { topic: TopicDetail }) {
  return (
    <ul className="space-y-4">
      {topic.contrasts.map((contrast) => {
        const explainedElsewhere = contrast.explained_in.filter(
          (explaining) => explaining.id !== topic.id,
        );
        return (
          <li key={contrast.topics.map((other) => other.id).join("+")}>
            <p className="font-medium">
              <AffixText>{contrast.title}</AffixText>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {contrast.topics.map((other) => (
                <TopicRefLink key={other.id} topic={other} />
              ))}
            </p>
            {explainedElsewhere.length > 0 && (
              <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-sm">
                <span className="text-slate-600">Разбор:</span>
                {explainedElsewhere.map((explaining) => (
                  <TopicRefLink key={explaining.id} topic={explaining} />
                ))}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Examples({ topic }: { topic: TopicDetail }) {
  const hasGloss = topic.examples.some((example) => example.gloss !== null);
  return (
    <>
      <ul className="space-y-3">
        {topic.examples.map((example, index) => (
          <ExampleCard key={index} example={example} />
        ))}
      </ul>
      {hasGloss && (
        <p className="mt-3 text-sm text-slate-600">
          Как читать разборы по морфемам — на странице{" "}
          <Link to={NOTATION_PATH} className={LINK_CLASS}>
            Обозначения
          </Link>
          .
        </p>
      )}
    </>
  );
}

/** Содержимое блока шаблона или null, если у темы для него ничего нет. */
function blockContent(kind: TemplateBlock, topic: TopicDetail): ReactNode {
  if (kind === "examples") {
    return topic.examples.length > 0 ? <Examples topic={topic} /> : null;
  }
  if (kind === "contrasts") {
    return topic.contrasts.length > 0 ? <Contrasts topic={topic} /> : null;
  }
  if (kind === "related") {
    return topic.related.length > 0 ? (
      <ul className="space-y-1">
        {topic.related.map((related) => (
          <li key={related.id}>
            <TopicRefLink topic={related} />
          </li>
        ))}
      </ul>
    ) : null;
  }
  const block = topic.blocks.find((candidate) => candidate.kind === kind);
  return block ? <ArticleMarkdown>{block.markdown}</ArticleMarkdown> : null;
}

/**
 * Блоки страницы в порядке шаблона. У заглушки нет ни статьи, ни примеров,
 * поэтому от шаблона остаются только блоки из связей: «Не путать» и «Связанные темы».
 */
function Article({ topic }: { topic: TopicDetail }) {
  return TEMPLATE_ORDER.map((kind) => {
    const content = blockContent(kind, topic);
    if (content === null) {
      return null;
    }
    return (
      <section key={kind} aria-labelledby={`block-${kind}`} className="mt-8">
        <h2
          id={`block-${kind}`}
          className="mb-3 text-xl font-semibold tracking-tight"
        >
          {TEMPLATE[kind]}
        </h2>
        {content}
      </section>
    );
  });
}

function PathNavigation({ topic }: { topic: TopicDetail }) {
  return (
    <nav
      aria-label="Учебный маршрут"
      className="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2"
    >
      {topic.previous && (
        <Link
          to={topicPath(topic.previous.id)}
          rel="prev"
          className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400"
        >
          <span className="block text-xs text-slate-500">
            ← Предыдущая тема
          </span>
          <span className="font-medium">
            <AffixText>{topic.previous.title}</AffixText>
          </span>
        </Link>
      )}
      {topic.next && (
        <Link
          to={topicPath(topic.next.id)}
          rel="next"
          className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-400 sm:col-start-2 sm:text-right"
        >
          <span className="block text-xs text-slate-500">Следующая тема →</span>
          <span className="font-medium">
            <AffixText>{topic.next.title}</AffixText>
          </span>
        </Link>
      )}
    </nav>
  );
}

/** Страница темы по шаблону; у заглушки вместо статьи — сообщение. */
function TopicView({ topic }: { topic: TopicDetail }) {
  const hasPlaceOnMap =
    topic.prerequisites.length > 0 ||
    topic.overviews.length > 0 ||
    topic.members.length > 0;
  return (
    <article>
      <PageTitle>{topic.title}</PageTitle>
      <header>
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <LevelBadge level={topic.level} />
          {topic.section.title}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          <AffixText>{topic.title}</AffixText>
        </h1>
        <p className="mt-3 text-lg text-slate-700">
          <AffixText>{topic.summary}</AffixText>
        </p>
        {hasPlaceOnMap && (
          <div className="mt-4 space-y-3 rounded-lg bg-slate-100 px-4 py-3 text-sm">
            <TopicLinks label="Пререквизиты" topics={topic.prerequisites} />
            <TopicLinks label="Входит в обзор" topics={topic.overviews} />
            <TopicLinks label="Темы обзора" topics={topic.members} />
          </div>
        )}
      </header>

      {topic.is_stub && (
        <p className="mt-8 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-slate-600">
          Статья ещё не написана.
        </p>
      )}
      <Article topic={topic} />

      <PathNavigation topic={topic} />
    </article>
  );
}

export function TopicPage() {
  const { id = "" } = useParams();
  const topic = useQuery(topicQuery(id));

  if (topic.isError && isNotFound(topic.error)) {
    return <NotFoundPage />;
  }
  return (
    <QueryView query={topic}>{(data) => <TopicView topic={data} />}</QueryView>
  );
}
