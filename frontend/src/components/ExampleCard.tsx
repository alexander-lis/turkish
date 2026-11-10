import type { Example, MarkedText } from "../api/types.ts";
import { GlossView } from "./GlossView.tsx";

function Marked({ text }: { text: MarkedText }) {
  return text.segments.map((segment, index) =>
    segment.emphasized ? (
      <mark key={index} className="bg-transparent font-semibold text-red-700">
        {segment.text}
      </mark>
    ) : (
      segment.text
    ),
  );
}

export function ExampleCard({ example }: { example: Example }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p
          lang="tr"
          className="text-lg leading-snug font-medium text-slate-900"
        >
          <Marked text={example.tr} />
        </p>
        {example.source === "generated" && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 text-xs leading-5 text-amber-900">
            сгенерировано
          </span>
        )}
      </div>
      <p className="mt-1 text-slate-600">
        <Marked text={example.ru} />
      </p>
      {example.gloss && <GlossView words={example.gloss} />}
      {example.note && (
        <p className="mt-3 border-l-2 border-slate-300 pl-3 text-sm text-slate-600">
          {example.note}
        </p>
      )}
    </li>
  );
}
