import { useQuery } from "@tanstack/react-query";
import { notationQuery } from "../api/queries.ts";
import { ArticleMarkdown } from "../components/ArticleMarkdown.tsx";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";

/** Страница «Обозначения»: как читать формулы и разборы, и таблица обозначений. */
export function NotationPage() {
  const notation = useQuery(notationQuery);

  return (
    <>
      <PageTitle>Обозначения</PageTitle>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Обозначения
      </h1>
      <QueryView query={notation}>
        {({ intro_markdown, abbreviations }) => (
          <>
            <div className="mt-4">
              <ArticleMarkdown>{intro_markdown}</ArticleMarkdown>
            </div>
            <div className="table-scroll mt-6" tabIndex={0}>
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Обозначения в разборах</caption>
                <thead className="border-b border-slate-300 text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pr-6 font-medium">
                      Обозначение
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Значение
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {abbreviations.map((abbreviation) => (
                    <tr key={abbreviation.code}>
                      <th scope="row" className="py-2 pr-6 font-normal">
                        <abbr className="gloss-abbr">{abbreviation.code}</abbr>
                      </th>
                      <td className="py-2">{abbreviation.meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </QueryView>
    </>
  );
}
