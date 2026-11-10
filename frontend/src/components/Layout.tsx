import { useEffect, useState, type MouseEvent } from "react";
import { Link, Outlet } from "react-router";
import { cx } from "../lib/cx.ts";
import { SITE_TITLE } from "../lib/site.ts";
import { NavPanel } from "./NavPanel.tsx";

const NAV_PANEL_ID = "nav-panel";

/**
 * Каркас страницы: шапка, панель навигации и область содержимого.
 * На узком экране панель скрыта и выдвигается кнопкой в шапке.
 */
export function Layout() {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!navOpen) {
      return;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setNavOpen(false);
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [navOpen]);

  // Переход по любой ссылке панели закрывает её: читатель уже выбрал, куда идти.
  function closeOnLinkClick(event: MouseEvent<HTMLElement>) {
    if (event.target instanceof Element && event.target.closest("a")) {
      setNavOpen(false);
    }
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[19rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 lg:col-span-2 lg:px-5">
        <button
          type="button"
          aria-label="Открыть навигацию"
          aria-expanded={navOpen}
          aria-controls={NAV_PANEL_ID}
          onClick={() => setNavOpen(true)}
          className="-ml-1 rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
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
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        </button>
        <Link to="/" className="font-semibold tracking-tight text-slate-900">
          {SITE_TITLE}
        </Link>
      </header>

      {navOpen && (
        <div
          aria-hidden="true"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      <aside
        id={NAV_PANEL_ID}
        onClick={closeOnLinkClick}
        className={cx(
          "fixed inset-y-0 left-0 z-40 w-76 max-w-[85vw] border-r border-slate-200 bg-white transition-[translate,visibility] duration-200",
          "lg:visible lg:sticky lg:top-14 lg:z-10 lg:h-[calc(100dvh-3.5rem)] lg:w-auto lg:max-w-none lg:translate-x-0",
          navOpen ? "visible translate-x-0" : "invisible -translate-x-full",
        )}
      >
        <NavPanel />
      </aside>

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-3xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
