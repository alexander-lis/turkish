import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  render,
  type BoundFunctions,
  type queries,
  type RenderResult,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../AppRoutes.tsx";

/** Запросы к части страницы: то, что возвращает within(). */
export type Scope = BoundFunctions<typeof queries>;

function renderWithProviders(ui: ReactNode, route: string): RenderResult {
  // Без повторов: тест на ошибку не должен ждать второй попытки.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Открыть приложение целиком по адресу, как это сделал бы читатель. */
export function renderApp(route = "/"): RenderResult {
  return renderWithProviders(<AppRoutes />, route);
}

/** Отрисовать отдельный компонент, которому нужны ссылки маршрутизатора. */
export function renderInRouter(ui: ReactNode): RenderResult {
  return renderWithProviders(ui, "/");
}
