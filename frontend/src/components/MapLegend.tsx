import { cx } from "../lib/cx.ts";
import { LEVELS } from "../lib/mapSettings.ts";
import {
  LEVEL_STRIPE,
  LINE_STYLES,
  type MapLineKind,
} from "../lib/mapStyle.ts";

const LINE_ORDER = Object.keys(LINE_STYLES) as MapLineKind[];

function NodeSample({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className={cx("h-5 w-10 shrink-0 rounded border", className)}
      />
      {label}
    </li>
  );
}

function LineSample({ kind }: { kind: MapLineKind }) {
  const line = LINE_STYLES[kind];
  const markerId = `legend-arrow-${kind}`;
  return (
    <li className="flex items-center gap-2">
      <svg
        aria-hidden="true"
        viewBox="0 0 40 10"
        className="h-2.5 w-10 shrink-0"
      >
        {line.arrow && (
          <defs>
            <marker
              id={markerId}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M0 0L10 5L0 10z" fill={line.stroke} />
            </marker>
          </defs>
        )}
        <line
          x1="1"
          y1="5"
          x2="38"
          y2="5"
          stroke={line.stroke}
          strokeWidth="2"
          strokeLinecap="round"
          {...(line.dash === undefined ? {} : { strokeDasharray: line.dash })}
          {...(line.arrow ? { markerEnd: `url(#${markerId})` } : {})}
        />
      </svg>
      {line.label}
    </li>
  );
}

/** Условные обозначения карты тем: узлы, уровни и виды линий. */
export function MapLegend() {
  return (
    <section
      aria-label="Условные обозначения"
      className="space-y-3 text-xs text-slate-700"
    >
      <div>
        <p className="mb-1 font-semibold text-slate-900">Темы</p>
        <ul className="space-y-1">
          <NodeSample
            label="Написанная тема"
            className="border-slate-300 bg-white"
          />
          <NodeSample
            label="Обзор"
            className="border-2 border-slate-300 bg-slate-100"
          />
          <NodeSample
            label="Не написано"
            className="border-dashed border-slate-400 bg-white"
          />
        </ul>
      </div>
      <div>
        <p className="mb-1 font-semibold text-slate-900">Уровни</p>
        <ul className="flex gap-3">
          {LEVELS.map((level) => (
            <li key={level} className="flex items-center gap-1">
              <span
                aria-hidden="true"
                className={cx("h-4 w-1.5 rounded-sm", LEVEL_STRIPE[level])}
              />
              {level}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="mb-1 font-semibold text-slate-900">Линии</p>
        <ul className="space-y-1">
          {LINE_ORDER.map((kind) => (
            <LineSample key={kind} kind={kind} />
          ))}
        </ul>
      </div>
    </section>
  );
}
