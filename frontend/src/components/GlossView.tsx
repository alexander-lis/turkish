import { Fragment } from "react";
import type { GlossedWord } from "../api/types.ts";

/**
 * Разбор по морфемам. Каждое слово — маленькая таблица из двух строк:
 * морфемы и под каждой её значение, поэтому столбцы всегда выровнены.
 * Дефисы между морфемами рисует CSS, в тексте ячеек их нет.
 */
export function GlossView({ words }: { words: GlossedWord[] }) {
  return (
    <div
      role="group"
      aria-label="Разбор по морфемам"
      className="gloss mt-3 flex flex-wrap gap-x-5 gap-y-2 rounded-md bg-slate-50 px-3 py-2"
    >
      {words.map((word, wordIndex) => (
        <table key={wordIndex} className="gloss-word">
          <tbody>
            <tr lang="tr" className="font-medium text-slate-900">
              {word.morphemes.map((morpheme, index) => (
                <td key={index}>{morpheme.form}</td>
              ))}
            </tr>
            <tr className="text-sm text-slate-600">
              {word.morphemes.map((morpheme, index) => (
                <td key={index}>
                  {morpheme.parts.map((part, partIndex) => (
                    <Fragment key={partIndex}>
                      {partIndex > 0 && "."}
                      {part.is_abbreviation ? (
                        <abbr className="gloss-abbr">{part.text}</abbr>
                      ) : (
                        part.text
                      )}
                    </Fragment>
                  ))}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      ))}
    </div>
  );
}
