import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  type BoundFunctions,
  type queries,
  type RenderResult,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router";
import { AppRoutes } from "../AppRoutes.tsx";
import {
  BACK_BUTTON_ID,
  LOCATION_PROBE_ID,
  LocationProbe,
} from "./LocationProbe.tsx";

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
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    route,
  );
}

/** Текущий адрес приложения, открытого renderApp. */
export function currentLocation(): string {
  return document.getElementById(LOCATION_PROBE_ID)?.textContent ?? "";
}

/** Нажать кнопку браузера «Назад» в приложении, открытом renderApp. */
export function goBack(): void {
  const button = document.getElementById(BACK_BUTTON_ID);
  if (button === null) throw new Error("приложение не открыто через renderApp");
  fireEvent.click(button);
}

/** Отрисовать отдельный компонент, которому нужны ссылки маршрутизатора. */
export function renderInRouter(ui: ReactNode): RenderResult {
  return renderWithProviders(ui, "/");
}
