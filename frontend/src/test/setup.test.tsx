/** Заглушки окружения из setup.ts: без них холст карты тем не рисуется в jsdom. */
import { render, screen } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { expect, test } from "vitest";

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
