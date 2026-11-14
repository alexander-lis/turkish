import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { cx } from "../lib/cx.ts";
import { useBackdropPress } from "./useBackdropPress.ts";

/** Строка списка: по id оболочка различает строки, по href строка открывается ссылкой. */
export interface SearchRow {
  id: string;
  href: string;
}

interface SearchDialogProps<Row extends SearchRow> {
  open: boolean;
  onClose: () => void;
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  /**
   * Строки по порядку. Оболочка их не фильтрует и не сортирует. Новый массив — новый
   * список: выбранной становится первая строка.
   */
  rows: readonly Row[];
  renderRow: (row: Row) => ReactNode;
  onSelect: (row: Row, target: "same-tab" | "new-tab") => void;
  /** Вместо списка, когда строк нет: подсказка, загрузка, ошибка, «Ничего не найдено». */
  status: ReactNode;
  /** Строка под списком; она же объявляется программам чтения с экрана. */
  summary: string;
}

function KeyHint({ keys, children }: { keys: string; children: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-sans text-[0.6875rem] leading-none text-slate-600 shadow-xs">
        {keys}
      </kbd>
      {children}
    </span>
  );
}

/**
 * Окно поиска: поле запроса и список строк под ним. О темах, индексе и адресах тем
 * оболочка не знает — строки приходят данными, а что значит выбор, решает тот, кто её
 * открыл. Окно — модальный <dialog>: неактивный фон, фокус внутри окна, Escape и возврат
 * фокуса даёт браузер. Разметка — «поле со списком» из руководства WAI-ARIA: фокус всё
 * время в поле, выбранную строку программам чтения с экрана называет aria-activedescendant.
 */
export function SearchDialog<Row extends SearchRow>({
  open,
  onClose,
  label,
  placeholder,
  query,
  onQueryChange,
  rows,
  renderRow,
  onSelect,
  status,
  summary,
}: SearchDialogProps<Row>) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const backdrop = useBackdropPress(onClose);
  const listId = useId();
  // Выбор помнит, в каком списке сделан: в новом списке выбрана первая строка.
  const [chosen, setChosen] = useState({ rows, index: 0 });
  const active = chosen.rows === rows ? chosen.index : 0;
  const activeRow = rows[active];

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (!open) {
      if (element.open) {
        element.close();
      }
      return;
    }
    if (!element.open) {
      element.showModal();
    }
    input.current?.focus();
  }, [open]);

  function optionId(row: Row): string {
    return `${listId}-${row.id}`;
  }

  function moveTo(index: number) {
    const next = Math.max(0, Math.min(index, rows.length - 1));
    setChosen({ rows, index: next });
    list.current?.children[next]?.scrollIntoView({ block: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Иначе стрелка переносит курсор в начало или конец поля.
      event.preventDefault();
      moveTo(active + (event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    // Enter, которым редактор метода ввода подтверждает набранное, строку не выбирает.
    if (event.key !== "Enter" || event.nativeEvent.isComposing) {
      return;
    }
    if (activeRow !== undefined) {
      event.preventDefault();
      onSelect(
        activeRow,
        event.metaKey || event.ctrlKey ? "new-tab" : "same-tab",
      );
    }
  }

  function onRowClick(event: MouseEvent<HTMLAnchorElement>, row: Row) {
    // Нажатие с клавишей-модификатором браузер сам откроет по адресу строки.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    onSelect(row, "same-tab");
  }

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onClose={(event) => {
        // Окно закрыл сам браузер — по Escape. Если его закрыл эффект выше, open уже снят.
        if (open && !event.currentTarget.open) {
          onClose();
        }
      }}
      onMouseDown={backdrop.onMouseDown}
      onClick={backdrop.onClick}
      // На широком экране окно стоит по центру и не меняет высоту: поле запроса не прыгает,
      // когда список растёт и сжимается. На узком окно прижато к верху и растёт по
      // содержимому: нижнюю часть экрана занимает клавиатура. Появляется окно плавно.
      className="m-0 mx-auto mt-3 w-[calc(100vw-1.5rem)] max-w-2xl overflow-hidden rounded-2xl bg-white text-slate-900 shadow-2xl ring-1 ring-slate-900/10 transition-[opacity,scale] duration-150 ease-out backdrop:bg-slate-900/50 backdrop:backdrop-blur-sm motion-reduce:transition-none sm:m-auto sm:h-[min(36rem,calc(100dvh-6rem))] starting:open:scale-[0.97] starting:open:opacity-0"
    >
      {/* Содержимое занимает всю площадь окна: нажатие на сам <dialog> — на затемнение. */}
      <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col sm:h-full sm:max-h-none">
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-5 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
          >
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="M13 13l4 4" />
          </svg>
          <input
            ref={input}
            type="text"
            role="combobox"
            aria-label={label}
            aria-expanded={rows.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              activeRow === undefined ? undefined : optionId(activeRow)
            }
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={onKeyDown}
            className="min-w-0 flex-1 bg-transparent py-4 text-base outline-none placeholder:text-slate-400 sm:text-lg"
          />
        </div>

        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={label}
          hidden={rows.length === 0}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {rows.map((row, index) => (
            <a
              key={row.id}
              id={optionId(row)}
              role="option"
              aria-selected={index === active}
              tabIndex={-1}
              href={row.href}
              // Нажатие не забирает фокус у поля: после него можно печатать дальше.
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => onRowClick(event, row)}
              // Движение указателя, а не наведение: список, который прокручивается под
              // неподвижным указателем, не перехватывает выбор у клавиатуры.
              onPointerMove={() => {
                if (index !== active) {
                  setChosen({ rows, index });
                }
              }}
              className={cx(
                "block scroll-my-2 rounded-xl px-3 py-2.5",
                index === active && "bg-slate-100",
              )}
            >
              {renderRow(row)}
            </a>
          ))}
        </div>
        {rows.length === 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2 sm:px-5">
            {status}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-4 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 sm:px-5">
          <p aria-live="polite" className="min-w-0 flex-1 truncate">
            {summary}
          </p>
          {/* Клавиши — подсказка для глаз: программам чтения их называет роль поля. */}
          <p aria-hidden="true" className="hidden shrink-0 gap-4 sm:flex">
            <KeyHint keys="↑↓">выбрать</KeyHint>
            <KeyHint keys="↵">открыть</KeyHint>
            <KeyHint keys="esc">закрыть</KeyHint>
          </p>
        </div>
      </div>
    </dialog>
  );
}
