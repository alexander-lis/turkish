import type { Level, TopicSummary } from "../api/types.ts";
import { LAYERS, type Layer } from "./mapLinks.ts";

/*
 * Настройки вида карты тем: включённые уровни и слои, развёрнутые разделы. Это привычки
 * читателя, поэтому они живут в localStorage, а не в адресе.
 */

/** Уровни в порядке изучения. Новый уровень в API ломает компиляцию, пока его не добавят. */
export const LEVELS = Object.keys({
  A1: null,
  A2: null,
  B1: null,
  B2: null,
} satisfies Record<Level, null>) as Level[];

const LAYER_IDS = Object.keys(LAYERS) as Layer[];

export interface MapSettings {
  levels: ReadonlySet<Level>;
  layers: ReadonlySet<Layer>;
  /** Идентификаторы развёрнутых разделов. */
  expanded: ReadonlySet<string>;
}

/** При первом открытии включены все уровни и только слой «Различения», разделы свёрнуты. */
export const DEFAULT_SETTINGS: MapSettings = {
  levels: new Set(LEVELS),
  layers: new Set(["contrasts"]),
  expanded: new Set(),
};

const STORAGE_KEY = "topic-map-view";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Известные значения из сохранённого списка или null, если это не список строк. */
function known<T extends string>(
  value: unknown,
  allowed: readonly T[],
): Set<T> | null {
  if (
    !Array.isArray(value) ||
    !value.every((item) => typeof item === "string")
  ) {
    return null;
  }
  return new Set(allowed.filter((item) => value.includes(item)));
}

/**
 * Настройки из сохранённой строки. Испорченное поле получает умолчание, неизвестные уровни,
 * слои и разделы отбрасываются. Если не осталось ни одного уровня, включены все.
 */
export function parseMapSettings(
  raw: string | null,
  sectionIds: readonly string[],
): MapSettings {
  let stored: unknown = null;
  try {
    stored = raw === null ? null : JSON.parse(raw);
  } catch {
    // Испорченная строка: берём умолчания.
  }
  if (!isRecord(stored)) {
    return DEFAULT_SETTINGS;
  }
  const levels = known(stored["levels"], LEVELS);
  return {
    levels: levels && levels.size > 0 ? levels : DEFAULT_SETTINGS.levels,
    layers: known(stored["layers"], LAYER_IDS) ?? DEFAULT_SETTINGS.layers,
    expanded:
      known(stored["expanded"], sectionIds) ?? DEFAULT_SETTINGS.expanded,
  };
}

export function serializeMapSettings(settings: MapSettings): string {
  return JSON.stringify({
    levels: [...settings.levels],
    layers: [...settings.layers],
    expanded: [...settings.expanded],
  });
}

export function loadMapSettings(sectionIds: readonly string[]): MapSettings {
  try {
    return parseMapSettings(localStorage.getItem(STORAGE_KEY), sectionIds);
  } catch {
    // Хранилище недоступно, например в приватном режиме: берём умолчания.
    return DEFAULT_SETTINGS;
  }
}

export function storeMapSettings(settings: MapSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeMapSettings(settings));
  } catch {
    // Настройки не переживут перезагрузку, но карта продолжит работать.
  }
}

function toggled<T>(items: ReadonlySet<T>, item: T): Set<T> {
  const next = new Set(items);
  if (!next.delete(item)) {
    next.add(item);
  }
  return next;
}

/** Включить или выключить уровень. Последний включённый уровень не выключается. */
export function toggleLevel(settings: MapSettings, level: Level): MapSettings {
  const levels = toggled(settings.levels, level);
  return levels.size === 0 ? settings : { ...settings, levels };
}

export function toggleLayer(settings: MapSettings, layer: Layer): MapSettings {
  return { ...settings, layers: toggled(settings.layers, layer) };
}

export function toggleSection(
  settings: MapSettings,
  sectionId: string,
): MapSettings {
  return { ...settings, expanded: toggled(settings.expanded, sectionId) };
}

/** Сделать тему видимой: развернуть её раздел и включить её уровень. */
export function revealTopic(
  settings: MapSettings,
  topic: TopicSummary,
): MapSettings {
  if (
    settings.levels.has(topic.level) &&
    settings.expanded.has(topic.section_id)
  ) {
    return settings;
  }
  return {
    ...settings,
    levels: new Set([...settings.levels, topic.level]),
    expanded: new Set([...settings.expanded, topic.section_id]),
  };
}
