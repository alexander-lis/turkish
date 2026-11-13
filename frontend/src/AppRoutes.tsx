import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { Loading } from "./components/QueryView.tsx";
import { MAP_PATH } from "./lib/site.ts";
import { NotationPage } from "./pages/NotationPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { TopicPage } from "./pages/TopicPage.tsx";

// Холст карты тяжелее остальных страниц вместе взятых: страница темы, открытая по прямой
// ссылке, его код не грузит.
const MapPage = lazy(async () => ({
  default: (await import("./pages/MapPage.tsx")).MapPage,
}));

/** Старый адрес карты: ссылки вида /map?topic=<id> открывают ту же тему на новом. */
function OldMapAddress() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: MAP_PATH, search }} replace />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          index
          element={
            <Suspense fallback={<Loading />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="map" element={<OldMapAddress />} />
        <Route path="topics/:id" element={<TopicPage />} />
        <Route path="notation" element={<NotationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
