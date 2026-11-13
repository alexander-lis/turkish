import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

/** Индикатор загрузки: его же показывает страница, пока грузится её код. */
export function Loading() {
  return (
    <p role="status" className="py-8 text-sm text-slate-500">
      Загрузка…
    </p>
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
