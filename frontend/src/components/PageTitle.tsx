import { SITE_TITLE } from "../lib/site.ts";

/** Заголовок вкладки браузера. React сам переносит тег в <head>. */
export function PageTitle({ children }: { children?: string }) {
  return <title>{children ? `${children} · ${SITE_TITLE}` : SITE_TITLE}</title>;
}
