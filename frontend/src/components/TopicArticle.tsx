import { use, useEffect, useId, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import type { TopicDetail, TopicRef } from "../api/types.ts";
import { blockAnchor, NOTATION_PATH } from "../lib/site.ts";
import {
  TEMPLATE,
  TEMPLATE_ORDER,
  type TemplateBlock,
} from "../lib/template.ts";
import { AffixText } from "./AffixText.tsx";
import { ArticleMarkdown } from "./ArticleMarkdown.tsx";
import { ExampleCard } from "./ExampleCard.tsx";
import { LevelBadge } from "./LevelBadge.tsx";
import { scrollToBlock } from "./scrollToBlock.ts";
import { TopicHrefContext } from "./topicHref.ts";
import { StubMark } from "./TopicMarks.tsx";

const LINK_CLASS = "font-medium text-red-700 hover:underline";

function TopicRefLink({ topic }: { topic: TopicRef }) {
  const topicHref = use(TopicHrefContext);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      <Link to={topicHref(topic.id)} className={LINK_CLASS}>
        <AffixText>{topic.title}</AffixText>
      </Link>
      {topic.is_stub && <StubMark />}
    </span>
  );
}

/** Столько тем сворачиваемый список показывает сразу; более длинный свёрнут. */
const LONG_LIST = 6;

/**
 * Список ссылок на темы с подписью: пререквизиты, обзоры темы, темы обзора. Сворачиваемый
 * список, если он длинный, свёрнут под подписью с числом тем: базовая тема нужна десяткам
 * других, и такой список отодвинул бы статью на экран вниз.
 */
function TopicLinks({
  label,
  topics,
  collapsible = false,
}: {
  label: string;
  topics: readonly TopicRef[];
  collapsible?: boolean;
}) {
  const labelId = useId();
  if (topics.length === 0) {
    return null;
  }
  const list = (
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
  );
  if (collapsible && topics.length > LONG_LIST) {
    return (
      <details>
        <summary className="cursor-pointer font-medium text-slate-600">
          <span id={labelId}>{label}</span>
          <span className="font-normal"> — тем: {topics.length}</span>
        </summary>
        {list}
      </details>
    );
  }
  return (
    <div>
      <p id={labelId} className="font-medium text-slate-600">
        {label}
      </p>
      {list}
    </div>
  );
}

/** Различения темы: что путают, с какими темами и где разбор, если он не в этой теме. */
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
 * Блоки темы в порядке шаблона. У заглушки нет ни статьи, ни примеров,
 * поэтому от шаблона остаются только блоки из связей: «Не путать» и «Связанные темы».
 */
function Blocks({ topic }: { topic: TopicDetail }) {
  return TEMPLATE_ORDER.map((kind) => {
    const content = blockContent(kind, topic);
    if (content === null) {
      return null;
    }
    return (
      <section key={kind} aria-labelledby={blockAnchor(kind)} className="mt-8">
        <h2
          id={blockAnchor(kind)}
          // Отступ прокрутки: заголовок блока, к которому ведёт адрес, не уходит под шапку
          // страницы. В окне темы шапки над областью чтения нет, и отступ там свой.
          className="mb-3 scroll-mt-20 text-xl font-semibold tracking-tight"
        >
          {TEMPLATE[kind]}
        </h2>
        {content}
      </section>
    );
  });
}

function PathNavigation({ topic }: { topic: TopicDetail }) {
  const topicHref = use(TopicHrefContext);
  return (
    <nav
      aria-label="Учебный маршрут"
      className="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2"
    >
      {topic.previous && (
        <Link
          to={topicHref(topic.previous.id)}
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
          to={topicHref(topic.next.id)}
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

interface TopicArticleProps {
  topic: TopicDetail;
  /** Идентификатор заголовка темы: им окно темы подписывает себя. */
  titleId?: string;
  /** Уровень и раздел над названием. Окно темы показывает их в своей полосе. */
  showLevelAndSection?: boolean;
  /**
   * Темы, которым эта нужна как пререквизит. Их знает только граф тем, поэтому список
   * «Нужна для» есть в окне темы на карте, а на странице темы его нет.
   */
  requiredFor?: readonly TopicRef[];
}

/**
 * Содержимое темы по шаблону — одно для страницы темы и окна темы на карте: название,
 * суть, место на карте, блоки статьи, переходы по учебному маршруту. У заглушки вместо
 * статьи — сообщение. Адреса ссылок на темы задаёт TopicHrefContext. Адрес с якорем блока
 * (#block-examples) открывает содержимое на этом блоке.
 */
export function TopicArticle({
  topic,
  titleId,
  showLevelAndSection = true,
  requiredFor = [],
}: TopicArticleProps) {
  const { hash, key: navigation } = useLocation();

  // Браузер сам к якорю не прокрутит: когда он обрабатывает адрес, тема ещё не загружена.
  // Прокручивает каждый переход, а не только смена якоря: повторный выбор той же строки
  // поиска снова открывает тему на блоке.
  useEffect(() => {
    scrollToBlock(hash);
  }, [topic.id, hash, navigation]);

  const hasPlaceOnMap =
    topic.prerequisites.length > 0 ||
    requiredFor.length > 0 ||
    topic.overviews.length > 0 ||
    topic.members.length > 0;
  return (
    <article>
      <header>
        {showLevelAndSection && (
          <p className="mb-2 flex items-center gap-2 text-sm text-slate-600">
            <LevelBadge level={topic.level} />
            {topic.section.title}
          </p>
        )}
        <h1
          id={titleId}
          className="text-2xl font-semibold tracking-tight sm:text-3xl"
        >
          <AffixText>{topic.title}</AffixText>
        </h1>
        <p className="mt-3 text-lg text-slate-700">
          <AffixText>{topic.summary}</AffixText>
        </p>
        {hasPlaceOnMap && (
          <div className="mt-4 space-y-3 rounded-lg bg-slate-100 px-4 py-3 text-sm">
            <TopicLinks label="Пререквизиты" topics={topic.prerequisites} />
            <TopicLinks label="Нужна для" topics={requiredFor} collapsible />
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
      <Blocks topic={topic} />

      <PathNavigation topic={topic} />
    </article>
  );
}
