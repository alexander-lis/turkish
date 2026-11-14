import { useEffect, useState } from "react";
import { TopicSearch } from "./TopicSearch.tsx";

/** Подсказка сочетания клавиш на кнопке: на macOS поиск открывает Cmd+K. */
function shortcutHint(): string {
  return /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘K" : "Ctrl K";
}

/**
 * Кнопка поиска в шапке и сочетание Cmd+K или Ctrl+K. Здесь живёт только «окно открыто»:
 * кнопка открывает окно, сочетание переключает его.
 */
export function SearchLauncher() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Клавиша, а не буква: при русской раскладке в event.key пришла бы «л».
      if (
        event.code !== "KeyK" ||
        !(event.metaKey || event.ctrlKey) ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      // Иначе Ctrl+K в Firefox и Chrome ставит фокус в строку поиска браузера.
      event.preventDefault();
      setOpen((current) => !current);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* На широком экране кнопка — поле по центру шапки; на узком от неё остаётся
          значок. Имя «Поиск» у неё есть всегда. */}
      <button
        type="button"
        aria-label="Поиск"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={() => setOpen(true)}
        className="ml-auto flex shrink-0 items-center gap-2 rounded-md p-2 text-slate-600 hover:bg-slate-100 sm:ml-0 sm:w-56 sm:rounded-lg sm:border sm:border-slate-300 sm:bg-slate-50 sm:px-3 sm:py-1.5 sm:text-sm sm:text-slate-500 sm:hover:border-slate-400 sm:hover:bg-white md:w-80 lg:w-96"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5 shrink-0 sm:size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
        >
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="M13 13l4 4" />
        </svg>
        <span className="hidden sm:inline">Поиск</span>
        <kbd className="ml-auto hidden rounded border border-slate-200 bg-white px-1.5 font-sans text-xs text-slate-500 sm:inline">
          {shortcutHint()}
        </kbd>
      </button>
      <TopicSearch open={open} onClose={() => setOpen(false)} />
    </>
  );
}
