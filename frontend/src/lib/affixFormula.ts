/**
 * Чередующиеся звуки формулы аффикса — заглавные буквы из content/notation.md.
 * Строчные буквы формулы не чередуются никогда.
 */
const ALTERNATIONS = new Map<string, readonly string[]>([
  ["A", ["a", "e"]],
  ["I", ["ı", "i", "u", "ü"]],
  ["D", ["d", "t"]],
  ["C", ["c", "ç"]],
  ["G", ["g", "k"]],
  ["K", ["k", "ğ"]],
]);

const LOWERCASE_THEN_UPPERCASE = /\p{Ll}.*\p{Lu}/u;

/**
 * Формула аффикса среди слов названия, по правилу из content/README.md: запись начинается
 * с дефиса либо содержит скобку, косую черту или заглавную букву после строчной —
 * `-lAr`, `-(y)I`, `mI`.
 */
export function isAffixFormula(word: string): boolean {
  return (
    word.startsWith("-") ||
    /[()/]/.test(word) ||
    LOWERCASE_THEN_UPPERCASE.test(word)
  );
}

/** Приписать к каждому началу каждое продолжение. */
function combine(
  starts: readonly string[],
  continuations: readonly string[],
): string[] {
  return starts.flatMap((start) =>
    continuations.map((continuation) => start + continuation),
  );
}

/** Разрезать запись по косой черте вне скобок. */
function splitOutsideBrackets(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let part = "";
  for (const char of text) {
    if (char === "/" && depth === 0) {
      parts.push(part);
      part = "";
      continue;
    }
    if (char === "(") {
      depth += 1;
    } else if (char === ")" && depth > 0) {
      depth -= 1;
    }
    part += char;
  }
  parts.push(part);
  return parts;
}

/** Варианты записи без косой черты вне скобок. Скобка без пары пропускается. */
function expandPart(part: string): string[] {
  let variants = [""];
  let position = 0;
  while (position < part.length) {
    const char = part.charAt(position);
    const closing = char === "(" ? part.indexOf(")", position) : -1;
    if (closing !== -1) {
      // Часть в скобках есть или её нет; косая черта внутри перечисляет, какой она бывает.
      const inside = part.slice(position + 1, closing);
      const options = inside.split("/").flatMap(expandPart);
      variants = combine(variants, [...options, ""]);
      position = closing + 1;
      continue;
    }
    if (char !== "(" && char !== ")") {
      variants = combine(variants, ALTERNATIONS.get(char) ?? [char]);
    }
    position += 1;
  }
  return variants;
}

/**
 * Варианты, которые описывает формула аффикса: заглавная буква заменяется каждым из своих
 * звуков, часть в скобках есть или её нет, варианты через косую черту берутся по очереди.
 * `-DA` — это `-da`, `-de`, `-ta`, `-te`. Среди вариантов есть и те, которых гармония
 * гласных не допускает (`-yacek`): поиску они не мешают.
 */
export function expandAffixFormula(formula: string): string[] {
  const variants = splitOutsideBrackets(formula).flatMap(expandPart);
  return [...new Set(variants)].filter((variant) => variant !== "");
}
