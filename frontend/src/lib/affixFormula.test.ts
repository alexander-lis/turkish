/** Формула аффикса в названии темы: узнавание и развёртка в варианты. */
import { describe, expect, test } from "vitest";
import { expandAffixFormula, isAffixFormula } from "./affixFormula.ts";

describe("isAffixFormula", () => {
  test.each([
    "-DA",
    "-da",
    "-(y)AcAK",
    "-(A/I)r",
    "-(y)ken",
    "-t",
    "dA",
    "mI",
    "(ki)",
    "ev/okul",
  ])("запись %s — формула", (word) => {
    expect(isAffixFormula(word)).toBe(true);
  });

  test.each([
    "daha",
    "Ali",
    "Ali'ninki",
    "Türkçe",
    "çünkü",
    "dur-",
    "Местный",
    "падеж",
    "Настоящее-будущее",
    "МН",
  ])("слово %s — не формула", (word) => {
    expect(isAffixFormula(word)).toBe(false);
  });
});

describe("expandAffixFormula", () => {
  test("заглавная буква заменяется каждым из своих звуков", () => {
    expect(expandAffixFormula("-DA")).toEqual(["-da", "-de", "-ta", "-te"]);
    expect(expandAffixFormula("dA")).toEqual(["da", "de"]);
    expect(expandAffixFormula("mI")).toEqual(["mı", "mi", "mu", "mü"]);
    expect(expandAffixFormula("-CIK")).toContain("-çuk");
    expect(expandAffixFormula("-GI")).toEqual(
      expect.arrayContaining(["-gı", "-ki", "-gu", "-kü"]),
    );
  });

  test("часть в скобках есть или её нет", () => {
    const variants = expandAffixFormula("-(y)AcAK");

    expect(variants).toHaveLength(16);
    expect(variants).toEqual(
      expect.arrayContaining([
        "-yacak",
        "-yecek",
        "-acak",
        "-ecek",
        "-yacağ",
        "-eceğ",
      ]),
    );
  });

  test("косая черта в скобках перечисляет, какой бывает необязательная часть", () => {
    expect(expandAffixFormula("-(A/I)r")).toEqual([
      "-ar",
      "-er",
      "-ır",
      "-ir",
      "-ur",
      "-ür",
      "-r",
    ]);
  });

  test("строчная буква остаётся как есть", () => {
    expect(expandAffixFormula("-(y)ken")).toEqual(["-yken", "-ken"]);
    expect(expandAffixFormula("-(I)yor")).toEqual([
      "-ıyor",
      "-iyor",
      "-uyor",
      "-üyor",
      "-yor",
    ]);
  });

  test("косая черта вне скобок делит запись на отдельные формулы", () => {
    expect(expandAffixFormula("-lI/-sIz")).toEqual([
      "-lı",
      "-li",
      "-lu",
      "-lü",
      "-sız",
      "-siz",
      "-suz",
      "-süz",
    ]);
    expect(expandAffixFormula("-(y)A/-DA")).toEqual([
      "-ya",
      "-ye",
      "-a",
      "-e",
      "-da",
      "-de",
      "-ta",
      "-te",
    ]);
  });

  test("самая длинная формула контента даёт 64 варианта", () => {
    const variants = expandAffixFormula("-DIğIndAn");

    expect(variants).toHaveLength(64);
    expect(variants).toContain("-dığından");
    expect(variants).toContain("-tüğünden");
  });

  test("слово в скобках — само слово, скобка без пары пропускается", () => {
    expect(expandAffixFormula("(ki)")).toEqual(["ki"]);
    expect(expandAffixFormula("(ki")).toEqual(["ki"]);
    expect(expandAffixFormula("ki)")).toEqual(["ki"]);
  });

  test("одинаковые варианты не повторяются", () => {
    expect(expandAffixFormula("-(a/a)r")).toEqual(["-ar", "-r"]);
  });
});
