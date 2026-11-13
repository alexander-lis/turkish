import { createContext } from "react";

/** Что делают узлы карты тем: страница передаёт это через контекст, а не в данных узла. */
interface MapNodeActions {
  selectTopic: (id: string) => void;
  toggleSection: (id: string) => void;
}

export const MapNodeActionsContext = createContext<MapNodeActions>({
  selectTopic: () => undefined,
  toggleSection: () => undefined,
});
