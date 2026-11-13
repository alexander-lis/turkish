import type { ReactNode } from "react";

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-full border border-slate-200 px-1.5 text-[0.6875rem] leading-5 whitespace-nowrap text-slate-500">
      {children}
    </span>
  );
}

/** Пометка темы-заглушки у ссылки на неё. */
export function StubMark() {
  return <Mark>не написано</Mark>;
}
