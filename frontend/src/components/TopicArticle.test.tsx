/** Требование «Окно темы показывает список «Нужна для»» — в части короткого и длинного списка. */
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test } from "vitest";
import { locativeDa, ref, topics } from "../test/fixtures.ts";
import { renderInRouter } from "../test/render.tsx";
import { TopicArticle } from "./TopicArticle.tsx";

function requiredFor(count: number) {
  return topics.slice(0, count).map((topic) => ref(topic.id));
}

test("короткий список «Нужна для» виден сразу, рядом с пререквизитами", () => {
  renderInRouter(
    <TopicArticle topic={locativeDa} requiredFor={requiredFor(6)} />,
  );

  const list = screen.getByRole("list", { name: "Нужна для" });
  expect(within(list).getAllByRole("link")).toHaveLength(6);
  expect(list.closest("details")).toBeNull();
  expect(screen.getByRole("list", { name: "Пререквизиты" })).toBeVisible();
});

test("длинный список «Нужна для» свёрнут под подписью с числом тем и раскрывается", async () => {
  renderInRouter(
    <TopicArticle topic={locativeDa} requiredFor={requiredFor(7)} />,
  );

  const details = screen.getByText("Нужна для").closest("details");
  if (details === null) throw new Error("длинный список не свёрнут");
  expect(details.open).toBe(false);
  expect(within(details).getByText("— тем: 7")).toBeInTheDocument();

  await userEvent.click(screen.getByText("Нужна для"));

  expect(details.open).toBe(true);
  expect(
    within(
      within(details).getByRole("list", { name: "Нужна для" }),
    ).getAllByRole("link"),
  ).toHaveLength(7);
});

test("без тем, которым нужна эта, списка «Нужна для» нет", () => {
  renderInRouter(<TopicArticle topic={locativeDa} />);

  expect(screen.queryByText("Нужна для")).not.toBeInTheDocument();
});
