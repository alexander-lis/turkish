import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach } from "vitest";
import { server } from "./server.ts";

// Перехват запросов включается до загрузки модулей приложения:
// клиент API запоминает fetch в момент своего создания.
server.listen({ onUnhandledFrame: "error" });

// В jsdom нет прокрутки: панель навигации прокручивает к открытой теме.
Element.prototype.scrollIntoView = () => undefined;

/*
 * Холст карты тем (React Flow) измеряет себя и узлы, а jsdom ничего не раскладывает.
 * Заглушки ниже — из руководства React Flow по тестированию: наблюдатель размеров сразу
 * сообщает о каждом элементе, размер элемента берётся из его стиля, масштаб — из transform.
 */
class ResizeObserverStub implements ResizeObserver {
  readonly #callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.#callback = callback;
  }

  observe(target: Element): void {
    // Холсту нужна только цель записи: размеры он читает у самого элемента.
    const entry = { target } as ResizeObserverEntry;
    this.#callback([entry], this);
  }

  unobserve(): void {
    // Наблюдение ничего не держит: снимать нечего.
  }

  disconnect(): void {
    // То же.
  }
}

class DOMMatrixReadOnlyStub {
  readonly m22: number;

  constructor(transform?: string) {
    const scale = /scale\(([\d.]+)\)/.exec(transform ?? "")?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}

function styleSize(element: HTMLElement, size: "width" | "height"): number {
  return Number.parseFloat(element.style[size]) || 1;
}

window.ResizeObserver = ResizeObserverStub;
Object.defineProperty(window, "DOMMatrixReadOnly", {
  value: DOMMatrixReadOnlyStub,
});
Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: {
    get(this: HTMLElement) {
      return styleSize(this, "width");
    },
  },
  offsetHeight: {
    get(this: HTMLElement) {
      return styleSize(this, "height");
    },
  },
});
Object.defineProperty(SVGElement.prototype, "getBBox", {
  value: () => ({ x: 0, y: 0, width: 0, height: 0 }),
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => {
  server.close();
});
