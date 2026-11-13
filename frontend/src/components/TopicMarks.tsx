import type { ReactNode } from "react";

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-slate-200 px-1.5 text-[0.6875rem] leading-5 whitespace-nowrap text-slate-500">
      {children}
    </span>
  );
}

/** Пометка темы-заглушки в списках. */
export function StubMark() {
  return <Mark>не написано</Mark>;
}

/** Пометка обзора в списках. */
export function OverviewMark() {
  return <Mark>обзор</Mark>;
}
