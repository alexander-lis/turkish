import { Link, NavLink, Outlet, useMatch } from "react-router";
import { cx } from "../lib/cx.ts";
import { MAP_PATH, mapTopicPath, SITE_TITLE } from "../lib/site.ts";

/**
 * Каркас страницы: шапка и область содержимого. У карты тем вид широкий: содержимое
 * занимает всё место под шапкой без полей и прокрутки. У остальных страниц — колонка
 * по центру.
 */
export function Layout() {
  const wide = useMatch(MAP_PATH) !== null;
  // Со страницы темы обе ссылки шапки возвращают на карту к этой же теме. Адрес берётся
  // из текущего, а не из истории: так возврат работает и во вкладке, открытой по ссылке.
  const topicId = useMatch("/topics/:id")?.params.id;
  const mapHref = topicId === undefined ? MAP_PATH : mapTopicPath(topicId);

  return (
    <div className={wide ? "flex h-dvh flex-col overflow-hidden" : "min-h-dvh"}>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 lg:px-5">
        <Link
          to={mapHref}
          className="font-semibold tracking-tight text-slate-900"
        >
          {SITE_TITLE}
        </Link>
        <NavLink
          to={mapHref}
          end
          className={({ isActive }) =>
            cx(
              "ml-auto rounded-md px-2.5 py-1.5 text-sm",
              isActive
                ? "bg-red-50 font-medium text-red-800"
                : "text-slate-700 hover:bg-slate-100",
            )
          }
        >
          Карта тем
        </NavLink>
      </header>

      {wide ? (
        <main className="relative min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      ) : (
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <div className="mx-auto max-w-3xl">
            <Outlet />
          </div>
        </main>
      )}
    </div>
  );
}
