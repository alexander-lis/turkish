/**
 * Заглушки окружения из setup.ts: без них в jsdom не рисуется холст карты тем,
 * не открывается окно темы и нет прокрутки к элементу.
 */
import { render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { expect, test, vi } from "vitest";

test("пустой холст React Flow рисуется в jsdom", () => {
  render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={[]} edges={[]} aria-label="Пустой холст" />
      </div>
    </ReactFlowProvider>,
  );

  expect(document.querySelector(".react-flow__viewport")).toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
});

test("узел с заданным размером виден на холсте", async () => {
  render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow
          nodes={[
            {
              id: "a",
              position: { x: 0, y: 0 },
              data: { label: "Узел" },
              width: 100,
              height: 30,
            },
          ]}
          edges={[]}
        />
      </div>
    </ReactFlowProvider>,
  );

  expect(await screen.findByText("Узел")).toBeVisible();
});

test("<dialog> открывается и закрывается: атрибут open и событие close", () => {
  render(<dialog aria-label="Окно">Содержимое</dialog>);
  const dialog = document.querySelector("dialog");
  if (dialog === null) throw new Error("окно не отрисовано");
  const onClose = vi.fn();
  dialog.addEventListener("close", onClose);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

  dialog.showModal();
  expect(dialog).toHaveAttribute("open");
  expect(screen.getByRole("dialog", { name: "Окно" })).toBeVisible();

  dialog.close();
  expect(dialog).not.toHaveAttribute("open");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(onClose).toHaveBeenCalledTimes(1);

  dialog.close();
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("scrollIntoView у элемента вызывается без ошибки", () => {
  render(<p>Строка</p>);
  const element = screen.getByText("Строка");

  expect(() => {
    element.scrollIntoView();
    element.scrollIntoView({ block: "nearest" });
  }).not.toThrow();
});
