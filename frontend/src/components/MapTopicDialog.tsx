import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useRef } from "react";
import { Link, useLocation } from "react-router";
import { topicQuery } from "../api/queries.ts";
import type { TopicRef, TopicSummary } from "../api/types.ts";
import { mapTopicPath, topicPath } from "../lib/site.ts";
import { LevelBadge } from "./LevelBadge.tsx";
import { scrollToBlock } from "./scrollToBlock.ts";
import { QueryView } from "./QueryView.tsx";
import { TopicArticle } from "./TopicArticle.tsx";
import { TopicHrefContext } from "./topicHref.ts";
import { useBackdropPress } from "./useBackdropPress.ts";

interface DialogProps {
  /** Выбранная тема; null — окно закрыто. */
  topic: TopicSummary | null;
  sectionTitle: string;
  /** Темы, которым выбранная нужна как пререквизит, в порядке учебного маршрута. */
  requiredFor: readonly TopicRef[];
  /** Снять выбор темы: окно закрывается, когда темы больше нет. */
  onClose: () => void;
}

/** Тот же запрос, что у страницы темы: после «Развернуть» она показывается из кеша. */
function TopicContent({
  id,
  titleId,
  requiredFor,
}: {
  id: string;
  titleId: string;
  requiredFor: readonly TopicRef[];
}) {
  const topic = useQuery(topicQuery(id));
  return (
    <QueryView query={topic}>
      {(data) => (
        <TopicArticle
          topic={data}
          titleId={titleId}
          showLevelAndSection={false}
          requiredFor={requiredFor}
        />
      )}
    </QueryView>
  );
}

/**
 * Окно темы поверх карты: то же содержимое, что на странице темы, а ссылки на темы
 * открывают их в этом же окне. Окно — модальный <dialog>: неактивный фон, фокус внутри
 * окна, закрытие по Escape и возврат фокуса на узел темы даёт браузер.
 */
export function MapTopicDialog({
  topic,
  sectionTitle,
  requiredFor,
  onClose,
}: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const backdrop = useBackdropPress(onClose);
  const titleId = useId();
  const topicId = topic?.id ?? null;
  const { key: navigation, hash } = useLocation();

  // Окно сверяется с темой после каждого перехода по адресу, а не только при смене темы.
  // По Escape окно закрывает сам браузер; если ту же тему тут же выбрали снова, страница
  // не успевает увидеть её снятой, и тема осталась бы в адресе при закрытом окне.
  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (topicId === null) {
      if (element.open) {
        element.close();
      }
      return;
    }
    const opening = !element.open;
    if (opening) {
      element.showModal();
    }
    // Фокус — на область чтения, а не на первую кнопку: так статья сразу прокручивается
    // с клавиатуры, а после перехода к другой теме фокус не теряется вместе со ссылкой.
    content.current?.focus();
    // К блоку из адреса содержимое прокручивает себя само, но в закрытом окне прокрутить
    // нечего: статью из кеша оно отрисовало раньше, чем окно открылось.
    if (opening) {
      scrollToBlock(hash);
    }
  }, [topicId, navigation, hash]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      // Пока статья грузится, заголовка с этим идентификатором ещё нет: имя окну даёт aria-label.
      aria-label={topic?.title}
      onClose={(event) => {
        // Окно закрыл сам браузер — по Escape. Если его закрыл эффект выше, темы уже нет.
        if (topicId !== null && !event.currentTarget.open) {
          onClose();
        }
      }}
      // Содержимое занимает всю площадь окна: нажатие на сам <dialog> — нажатие
      // на затемнение вокруг него. Второе нажатие двойного щелчка по узлу, которым окно
      // только что открыли, его не закрывает.
      onMouseDown={backdrop.onMouseDown}
      onClick={backdrop.onClick}
      className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-white text-slate-900 backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px] sm:m-auto sm:h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)] sm:max-w-4xl sm:rounded-2xl sm:shadow-2xl"
    >
      {topic && (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 py-2 pr-2 pl-4 sm:pl-8">
            <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-600">
              <LevelBadge level={topic.level} />
              <span className="truncate">{sectionTitle}</span>
            </p>
            <Link
              to={topicPath(topic.id)}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 4h4v4M16 4l-5 5M8 16H4v-4M4 16l5-5" />
              </svg>
              Развернуть
            </Link>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={onClose}
              className="shrink-0 rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
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
          {/* Новая тема — новая область: прокрутка начинается с начала статьи. */}
          <div
            key={topic.id}
            ref={content}
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-6 outline-none sm:px-8 sm:py-8 [&_h2]:scroll-mt-4"
          >
            <div className="mx-auto max-w-3xl">
              <TopicHrefContext value={mapTopicPath}>
                <TopicContent
                  id={topic.id}
                  titleId={titleId}
                  requiredFor={requiredFor}
                />
              </TopicHrefContext>
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
