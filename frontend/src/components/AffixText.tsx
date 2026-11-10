// Запись аффикса или разбора: слово начинается с дефиса (-lAr) или содержит два дефиса (ev-ler-im).
const AFFIX_LIKE = /^-|-.*-/;

/**
 * Текст, в котором запись аффикса не рвётся при переносе строки.
 * Без этого браузер оставляет дефис в конце строки, а «(I)yor» уносит на следующую.
 */
export function AffixText({ children }: { children: string }) {
  return children.split(/(\s+)/).map((part, index) =>
    AFFIX_LIKE.test(part) ? (
      <span key={index} className="whitespace-nowrap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}
