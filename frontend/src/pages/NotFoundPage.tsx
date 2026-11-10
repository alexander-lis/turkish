import { Link } from "react-router";
import { PageTitle } from "../components/PageTitle.tsx";

export function NotFoundPage() {
  return (
    <>
      <PageTitle>Страница не найдена</PageTitle>
      <h1 className="text-2xl font-semibold tracking-tight">
        Страница не найдена
      </h1>
      <p className="mt-3 text-slate-600">
        По этому адресу нет ни страницы, ни темы справочника.
      </p>
      <p className="mt-4">
        <Link to="/" className="font-medium text-red-700 hover:underline">
          На главную
        </Link>
      </p>
    </>
  );
}
