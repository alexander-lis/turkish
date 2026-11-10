import { Route, Routes } from "react-router";
import { Layout } from "./components/Layout.tsx";
import { HomePage } from "./pages/HomePage.tsx";
import { NotationPage } from "./pages/NotationPage.tsx";
import { NotFoundPage } from "./pages/NotFoundPage.tsx";
import { TopicPage } from "./pages/TopicPage.tsx";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="topics/:id" element={<TopicPage />} />
        <Route path="notation" element={<NotationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
