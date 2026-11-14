/**
 * Буквы, которые поиск не различает. Заглавные названы явно: «İ» в нижнем регистре —
 * два символа, а свёртка обязана менять символ на один символ.
 */
const FOLDED = new Map<string, string>([
  ["İ", "i"],
  ["I", "i"],
  ["ı", "i"],
  ["Î", "i"],
  ["î", "i"],
  ["Ç", "c"],
  ["ç", "c"],
  ["Ğ", "g"],
  ["ğ", "g"],
  ["Ö", "o"],
  ["ö", "o"],
  ["Ş", "s"],
  ["ş", "s"],
  ["Ü", "u"],
  ["ü", "u"],
  ["Û", "u"],
  ["û", "u"],
  ["Â", "a"],
  ["â", "a"],
  ["Ё", "е"],
  ["ё", "е"],
]);

/**
 * Свернуть текст для сравнения: без регистра и диакритики. Каждый символ заменяется одним
 * символом, поэтому место совпадения в свёрнутой строке — то же, что в исходной.
 */
export function foldText(text: string): string {
  let folded = "";
  for (const char of text) {
    const lower = FOLDED.get(char) ?? char.toLowerCase();
    folded += lower.length === char.length ? lower : char;
  }
  return folded;
}

/** Срезать дефисы по краям слова: «-da» и «da» — одно и то же. */
export function trimHyphens(word: string): string {
  return word.replace(/^-+|-+$/g, "");
}

/** Слова запроса, свёрнутые для сравнения. Набор в NFD — та же буква, что в NFC. */
export function queryWords(query: string): string[] {
  return foldText(query.normalize("NFC"))
    .split(/\s+/)
    .map(trimHyphens)
    .filter((word) => word !== "");
}
