/**
 * Свёртка текста для поиска и требование «Регистр и диакритика не влияют на поиск»
 * на уровне строк.
 */
import { describe, expect, test } from "vitest";
import { foldText, queryWords, trimHyphens } from "./searchFold.ts";

describe("foldText", () => {
  test.each([
    "İstanbul'da IĞDIR ışık",
    "ÇÜNKÜ çünkü Hâlâ kâğıt sükûnet",
    "Ещё ёж, Ёлка — «Местный падеж -DA»",
    "ẞ ǅ ﬁ 𐐀",
    "",
  ])("длина строки «%s» после свёртки не меняется", (text) => {
    expect(foldText(text)).toHaveLength(text.length);
  });

  test("İ, I и ı дают i", () => {
    expect(foldText("İ")).toBe("i");
    expect(foldText("I")).toBe("i");
    expect(foldText("ı")).toBe("i");
    expect(foldText("IŞIK ışık İyi iyi")).toBe("isik isik iyi iyi");
  });

  test("запрос без диакритики равен слову с диакритикой", () => {
    expect(foldText("çünkü")).toBe("cunku");
    expect(foldText("çünkü")).toBe(foldText("cunku"));
  });

  test("запрос заглавными буквами равен слову строчными", () => {
    expect(foldText("ÇÜNKÜ")).toBe(foldText("çünkü"));
    expect(foldText("МЕСТНЫЙ")).toBe(foldText("местный"));
  });

  test("циркумфлекс и «ё» не различаются", () => {
    expect(foldText("hâlâ")).toBe("hala");
    expect(foldText("sükûnet Îmân")).toBe("sukunet iman");
    expect(foldText("ещё")).toBe(foldText("еще"));
    expect(foldText("Ёлка")).toBe("елка");
  });

  test("буквы ç, ğ, ö, ş, ü сворачиваются в буквы без диакритики", () => {
    expect(foldText("çğöşü ÇĞÖŞÜ")).toBe("cgosu cgosu");
  });

  test("символ вне пар остаётся на месте", () => {
    expect(foldText("-(y)AcAK: «да» 5'te")).toBe("-(y)acak: «да» 5'te");
  });
});

describe("queryWords", () => {
  test("запрос делится на слова по пробелам", () => {
    expect(queryWords("  падеж   мест ")).toEqual(["падеж", "мест"]);
  });

  test("слова свёрнуты", () => {
    expect(queryWords("ÇÜNKÜ Ещё")).toEqual(["cunku", "еще"]);
  });

  test("дефисы по краям слова срезаются, внутри — остаются", () => {
    expect(queryWords("-da")).toEqual(queryWords("da"));
    expect(queryWords("-DA dur- настоящее-будущее")).toEqual([
      "da",
      "dur",
      "настоящее-будущее",
    ]);
  });

  test("запрос в NFD даёт те же слова, что в NFC", () => {
    expect(queryWords("çünkü ещё".normalize("NFD"))).toEqual(["cunku", "еще"]);
  });

  test("в пустом запросе и в запросе из одних дефисов слов нет", () => {
    expect(queryWords("")).toEqual([]);
    expect(queryWords("   ")).toEqual([]);
    expect(queryWords("- --")).toEqual([]);
  });
});

test("trimHyphens срезает дефисы только по краям", () => {
  expect(trimHyphens("-da")).toBe("da");
  expect(trimHyphens("ol-")).toBe("ol");
  expect(trimHyphens("ev-de")).toBe("ev-de");
});
