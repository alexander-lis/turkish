/**
 * Требования «Настройки вида сохраняются» и «Положение карты сохраняется» — в части чтения
 * и записи настроек и положения.
 */
import { describe, expect, test, vi } from "vitest";
import { topics } from "../test/fixtures.ts";
import {
  DEFAULT_SETTINGS,
  loadMapSettings,
  loadViewport,
  parseMapSettings,
  parseViewport,
  revealTopic,
  serializeMapSettings,
  storeMapSettings,
  storeViewport,
  toggleLevel,
  type MapSettings,
} from "./mapSettings.ts";

const SECTION_IDS = ["nouns", "phonetics", "verbs"];

const custom: MapSettings = {
  levels: new Set(["A1", "A2", "B1"]),
  layers: new Set(["prerequisites", "contrasts"]),
  expanded: new Set(["nouns", "verbs"]),
};

function topic(id: string) {
  const found = topics.find((candidate) => candidate.id === id);
  if (!found) throw new Error(`нет темы ${id}`);
  return found;
}

describe("чтение", () => {
  test("при пустом хранилище — умолчания: все уровни, слой «Различения», разделы свёрнуты", () => {
    expect(parseMapSettings(null, SECTION_IDS)).toEqual({
      levels: new Set(["A1", "A2", "B1", "B2"]),
      layers: new Set(["contrasts"]),
      expanded: new Set(),
    });
  });

  test("сохранённые настройки восстанавливаются", () => {
    expect(parseMapSettings(serializeMapSettings(custom), SECTION_IDS)).toEqual(
      custom,
    );
  });

  test("неизвестный раздел, уровень и слой отбрасываются", () => {
    const raw = JSON.stringify({
      levels: ["A1", "C1"],
      layers: ["related", "colors"],
      expanded: ["nouns", "gone"],
    });

    expect(parseMapSettings(raw, SECTION_IDS)).toEqual({
      levels: new Set(["A1"]),
      layers: new Set(["related"]),
      expanded: new Set(["nouns"]),
    });
  });

  test.each([
    ["не JSON", "{levels"],
    ["не объект", "[1, 2]"],
    ["null", "null"],
  ])("испорченное значение (%s) даёт умолчания", (_, raw) => {
    expect(parseMapSettings(raw, SECTION_IDS)).toEqual(DEFAULT_SETTINGS);
  });

  test("испорченное поле получает умолчание, остальные сохраняются", () => {
    const raw = JSON.stringify({
      levels: [],
      layers: "prerequisites",
      expanded: ["verbs"],
    });

    expect(parseMapSettings(raw, SECTION_IDS)).toEqual({
      levels: DEFAULT_SETTINGS.levels,
      layers: DEFAULT_SETTINGS.layers,
      expanded: new Set(["verbs"]),
    });
  });
});

describe("хранилище", () => {
  test("записанное читается обратно", () => {
    storeMapSettings(custom);

    expect(loadMapSettings(SECTION_IDS)).toEqual(custom);
  });

  test("при недоступном хранилище — умолчания, а запись не падает", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("хранилище недоступно");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("хранилище недоступно");
      });
    try {
      expect(loadMapSettings(SECTION_IDS)).toEqual(DEFAULT_SETTINGS);
      expect(() => storeMapSettings(custom)).not.toThrow();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("положение карты", () => {
  test("при пустом хранилище положения нет", () => {
    expect(parseViewport(null)).toBeNull();
    expect(loadViewport()).toBeNull();
  });

  test("сохранённое положение восстанавливается", () => {
    storeViewport({ x: -120.5, y: 80, zoom: 0.75 });

    expect(loadViewport()).toEqual({ x: -120.5, y: 80, zoom: 0.75 });
  });

  test("в хранилище идут только сдвиг и масштаб", () => {
    const viewport = { x: 1, y: 2, zoom: 1.5, extra: "лишнее" };

    storeViewport(viewport);

    expect(loadViewport()).toEqual({ x: 1, y: 2, zoom: 1.5 });
  });

  test.each([
    ["не JSON", "{x:"],
    ["не объект", "[0, 0, 1]"],
    ["null", "null"],
    ["без масштаба", '{"x": 0, "y": 0}'],
    ["без сдвига", '{"zoom": 1}'],
    ["строка вместо числа", '{"x": "0", "y": 0, "zoom": 1}'],
    ["нулевой масштаб", '{"x": 0, "y": 0, "zoom": 0}'],
    ["отрицательный масштаб", '{"x": 0, "y": 0, "zoom": -1}'],
    ["число вне диапазона", '{"x": 1e999, "y": 0, "zoom": 1}'],
  ])("испорченное или неполное значение (%s) отбрасывается", (_, raw) => {
    expect(parseViewport(raw)).toBeNull();
  });

  test("при недоступном хранилище положения нет, а запись не падает", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("хранилище недоступно");
      });
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("хранилище недоступно");
      });
    try {
      expect(loadViewport()).toBeNull();
      expect(() => {
        storeViewport({ x: 0, y: 0, zoom: 1 });
      }).not.toThrow();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });
});

describe("изменения", () => {
  test("последний включённый уровень не выключается", () => {
    const onlyA1: MapSettings = {
      ...DEFAULT_SETTINGS,
      levels: new Set(["A1"]),
    };

    expect(toggleLevel(onlyA1, "A1").levels).toEqual(new Set(["A1"]));
    expect(toggleLevel(onlyA1, "B2").levels).toEqual(new Set(["A1", "B2"]));
  });

  test("тема становится видимой: её раздел развёрнут, уровень включён", () => {
    const hidden: MapSettings = {
      ...DEFAULT_SETTINGS,
      levels: new Set(["A1"]),
    };

    const revealed = revealTopic(hidden, topic("ablative-dan"));

    expect(revealed.levels).toEqual(new Set(["A1", "B2"]));
    expect(revealed.expanded).toEqual(new Set(["nouns"]));
    expect(revealTopic(revealed, topic("ablative-dan"))).toBe(revealed);
  });
});
