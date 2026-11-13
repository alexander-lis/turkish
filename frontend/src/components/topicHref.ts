import { createContext } from "react";
import { topicPath } from "../lib/site.ts";

/**
 * Куда ведёт ссылка на тему: функция «идентификатор → адрес». По умолчанию — на страницу
 * темы; окно темы на карте ставит адрес той же карты с этой темой.
 */
export const TopicHrefContext =
  createContext<(id: string) => string>(topicPath);
