import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { Loading } from "./components/QueryView.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { NotationPage } from "./pages/NotationPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { TopicPage } from "./pages/TopicPage.tsx";

// Холст карты тяжелее остальных страниц вместе взятых: его код грузится при первом открытии карты.
const MapPage = lazy(async () => ({
  default: (await import("./pages/MapPage.tsx")).MapPage,
}));

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="topics/:id" element={<TopicPage />} />
        <Route path="notation" element={<NotationPage />} />
        <Route
          path="map"
          element={
            <Suspense fallback={<Loading />}>
              <MapPage />
            </Suspense>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
