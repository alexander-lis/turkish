import { useId, useState, type ReactNode } from "react";
import type { Level } from "../api/types.ts";
import { cx } from "../lib/cx.ts";
import { LAYERS, type Layer } from "../lib/mapLinks.ts";
import { LEVELS, type MapSettings } from "../lib/mapSettings.ts";
import { LEVEL_STRIPE } from "../lib/mapStyle.ts";
import { MapLegend } from "./MapLegend.tsx";

interface ToolbarProps {
  settings: MapSettings;
  allExpanded: boolean;
  onToggleLevel: (level: Level) => void;
  onToggleLayer: (layer: Layer) => void;
  onExpandAll: (expand: boolean) => void;
  onFitView: () => void;
}

const ACTION_CLASS =
  "rounded-md border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-800 hover:border-slate-500";

function Toggle({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        "flex items-center gap-1.5 rounded-md px-2 py-1",
        pressed
          ? "bg-white font-medium text-slate-900 shadow-sm"
          : "text-slate-500 hover:text-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function ToggleGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1"
    >
      {children}
    </div>
  );
}

/**
 * Переключатели вида карты: «Показать всё», сворачивание разделов, слои, уровни
 * и условные обозначения. На узком экране они собраны в сворачиваемый блок.
 */
export function MapToolbar({
  settings,
  allExpanded,
  onToggleLevel,
  onToggleLayer,
  onExpandAll,
  onFitView,
}: ToolbarProps) {
  const [open, setOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const blockId = useId();
  const legendId = useId();

  return (
    <div className="pointer-events-none absolute top-3 left-3 z-10 flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col items-start gap-2 text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={blockId}
        onClick={() => setOpen(!open)}
        className={cx(ACTION_CLASS, "pointer-events-auto shadow-sm sm:hidden")}
      >
        Вид карты
      </button>
      <div
        id={blockId}
        className={cx(
          "pointer-events-auto min-h-0 w-72 max-w-full space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-white/95 p-2 shadow-sm",
          open ? "block" : "hidden sm:block",
        )}
      >
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onFitView} className={ACTION_CLASS}>
            Показать всё
          </button>
          <button
            type="button"
            onClick={() => onExpandAll(!allExpanded)}
            className={ACTION_CLASS}
          >
            {allExpanded ? "Свернуть все" : "Развернуть все"}
          </button>
        </div>
        <ToggleGroup label="Слои связей">
          {(Object.keys(LAYERS) as Layer[]).map((layer) => (
            <Toggle
              key={layer}
              pressed={settings.layers.has(layer)}
              onClick={() => onToggleLayer(layer)}
            >
              {LAYERS[layer]}
            </Toggle>
          ))}
        </ToggleGroup>
        <ToggleGroup label="Уровни">
          {LEVELS.map((level) => (
            <Toggle
              key={level}
              pressed={settings.levels.has(level)}
              onClick={() => onToggleLevel(level)}
            >
              <span
                aria-hidden="true"
                className={cx("h-3.5 w-1.5 rounded-sm", LEVEL_STRIPE[level])}
              />
              {level}
            </Toggle>
          ))}
        </ToggleGroup>
        <button
          type="button"
          aria-expanded={legendOpen}
          aria-controls={legendId}
          onClick={() => setLegendOpen(!legendOpen)}
          className="px-1 font-medium text-slate-600 hover:text-slate-900"
        >
          Условные обозначения{" "}
          <span aria-hidden="true">{legendOpen ? "▴" : "▾"}</span>
        </button>
        <div id={legendId} hidden={!legendOpen} className="px-1 pb-1">
          {legendOpen && <MapLegend />}
        </div>
      </div>
    </div>
  );
}
