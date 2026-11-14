import { Link, NavLink, Outlet, useMatch } from "react-router";
import { cx } from "../lib/cx.ts";
import { MAP_PATH, mapTopicPath, SITE_TITLE } from "../lib/site.ts";
import { SearchLauncher } from "./SearchLauncher.tsx";

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
      {/* От точки sm шапка — три колонки: поле поиска стоит ровно по центру, какой бы
          ширины ни были название и ссылка по бокам. На узком экране значок поиска
          прижат к ссылке справа. */}
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-4 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4 lg:px-5">
        <Link
          to={mapHref}
          className="min-w-0 truncate font-semibold tracking-tight text-slate-900 sm:justify-self-start"
        >
          {SITE_TITLE}
        </Link>
        <SearchLauncher />
        <NavLink
          to={mapHref}
          end
          className={({ isActive }) =>
            cx(
              "shrink-0 rounded-md px-2.5 py-1.5 text-sm sm:justify-self-end",
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
