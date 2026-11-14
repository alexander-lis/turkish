import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

/**
 * Индикатор загрузки: его же показывает страница, пока грузится её код. Стоит по центру
 * места, которое ему досталось, и появляется с задержкой: быстрая загрузка обходится без
 * мелькания на экране.
 */
export function Loading() {
  return (
    <div
      role="status"
      className="animate-appear flex h-full min-h-40 items-center justify-center"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-8 animate-spin"
        fill="none"
        strokeWidth="2.5"
      >
        <circle cx="12" cy="12" r="9" className="stroke-slate-200" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          className="stroke-red-600"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Загрузка…</span>
    </div>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="my-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm"
    >
      <p className="font-medium text-red-900">Не удалось загрузить данные.</p>
      <p className="mt-1 text-red-800">
        Проверьте, что сервер справочника запущен.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-800"
      >
        Повторить
      </button>
    </div>
  );
}

interface QueryViewProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
}

/** Показывает загрузку, ошибку с повтором или данные запроса. */
export function QueryView<T>({ query, children }: QueryViewProps<T>) {
  if (query.isPending || (query.isError && query.isFetching)) {
    return <Loading />;
  }
  if (query.isError) {
    return <LoadError onRetry={() => void query.refetch()} />;
  }
  return children(query.data);
}
