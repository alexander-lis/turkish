import { use, type ComponentProps } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import { Link } from "react-router";
import remarkGfm from "remark-gfm";
import { TopicHrefContext } from "./topicHref.ts";

const TOPIC_SCHEME = "topic:";

// react-markdown вырезает адреса с незнакомой схемой; ссылки на темы надо пропустить.
function urlTransform(url: string): string {
  return url.startsWith(TOPIC_SCHEME) ? url : defaultUrlTransform(url);
}

/** Ссылка в тексте: на тему — по адресу из TopicHrefContext, внешняя — в новой вкладке. */
function ArticleLink({ href, children }: ComponentProps<"a">) {
  const topicHref = use(TopicHrefContext);
  if (href?.startsWith(TOPIC_SCHEME)) {
    return (
      <Link to={topicHref(href.slice(TOPIC_SCHEME.length))}>{children}</Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

const components: Components = {
  a: ArticleLink,
  // Широкая таблица прокручивается внутри своей области, а не вместе со страницей.
  table({ children }) {
    return (
      <div className="table-scroll" tabIndex={0}>
        <table>{children}</table>
      </div>
    );
  },
};

/**
 * Текст статьи в Markdown. HTML-разметка внутри текста не исполняется:
 * плагинов для сырого HTML здесь нет.
 */
export function ArticleMarkdown({ children }: { children: string }) {
  return (
    <div className="article-text prose prose-slate max-w-none">
      <Markdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={components}
      >
        {children}
      </Markdown>
    </div>
  );
}
