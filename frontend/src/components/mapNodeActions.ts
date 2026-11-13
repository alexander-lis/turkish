import { createContext } from "react";

/** Что делают узлы карты тем: страница передаёт это через контекст, а не в данных узла. */
interface MapNodeActions {
  selectTopic: (id: string) => void;
  toggleSection: (id: string) => void;
  /** Показать связи темы, пока на её узле указатель или фокус, и снять показ. */
  highlightTopic: (id: string, on: boolean) => void;
}

export const MapNodeActionsContext = createContext<MapNodeActions>({
  selectTopic: () => undefined,
  toggleSection: () => undefined,
  highlightTopic: () => undefined,
});
