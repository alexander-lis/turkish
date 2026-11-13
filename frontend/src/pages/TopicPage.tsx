import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { isNotFound } from "../api/client.ts";
import { topicQuery } from "../api/queries.ts";
import { PageTitle } from "../components/PageTitle.tsx";
import { QueryView } from "../components/QueryView.tsx";
import { TopicArticle } from "../components/TopicArticle.tsx";
import { NotFoundPage } from "./NotFoundPage.tsx";

/** Страница темы: содержимое темы и заголовок вкладки. */
export function TopicPage() {
  const { id = "" } = useParams();
  const topic = useQuery(topicQuery(id));

  if (topic.isError && isNotFound(topic.error)) {
    return <NotFoundPage />;
  }
  return (
    <QueryView query={topic}>
      {(data) => (
        <>
          <PageTitle>{data.title}</PageTitle>
          <TopicArticle topic={data} />
        </>
      )}
    </QueryView>
  );
}
