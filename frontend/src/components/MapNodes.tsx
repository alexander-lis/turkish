import { Handle, Position, type NodeProps } from "@xyflow/react";
import { use, type MouseEvent } from "react";
import { cx } from "../lib/cx.ts";
import {
  HANDLES,
  type SectionFlowNode,
  type TopicFlowNode,
} from "../lib/mapFlow.ts";
import { LEVEL_STRIPE } from "../lib/mapStyle.ts";
import { SITE_TITLE } from "../lib/site.ts";
import { MapNodeActionsContext } from "./mapNodeActions.ts";

/** Невидимые точки крепления линий с обеих сторон узла. */
function Handles() {
  const className = "pointer-events-none! opacity-0!";
  return (
    <>
      <Handle
        id={HANDLES.leftIn}
        type="target"
        position={Position.Left}
        isConnectable={false}
        className={className}
      />
      <Handle
        id={HANDLES.leftOut}
        type="source"
        position={Position.Left}
        isConnectable={false}
        className={className}
      />
      <Handle
        id={HANDLES.rightIn}
        type="target"
        position={Position.Right}
        isConnectable={false}
        className={className}
      />
      <Handle
        id={HANDLES.rightOut}
        type="source"
        position={Position.Right}
        isConnectable={false}
        className={className}
      />
    </>
  );
}

// Нажатие на узел не должно доходить до холста: там оно сняло бы выбор.
function stop(event: MouseEvent) {
  event.stopPropagation();
}

/** Имя узла темы для программ чтения с экрана: название, уровень и пометки. */
function topicLabel(topic: TopicFlowNode["data"]["topic"]): string {
  return [
    topic.title,
    topic.level,
    topic.is_overview && "обзор",
    topic.is_stub && "не написано",
  ]
    .filter(Boolean)
    .join(", ");
}

export function RootNode() {
  return (
    <div className="flex size-full items-center justify-center rounded-xl bg-slate-900 px-3 text-center text-sm font-semibold text-white shadow-sm">
      <Handles />
      {SITE_TITLE}
    </div>
  );
}

export function SectionNode({ data }: NodeProps<SectionFlowNode>) {
  const { toggleSection } = use(MapNodeActionsContext);
  const { section, topicCount, expanded } = data.section;
  return (
    <>
      <Handles />
      <button
        type="button"
        aria-expanded={expanded}
        aria-label={`${section.title}, тем: ${topicCount}`}
        title={section.title}
        onClick={(event) => {
          stop(event);
          toggleSection(section.id);
        }}
        className={cx(
          "nodrag flex size-full items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm font-semibold text-slate-900 shadow-sm",
          "hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700",
          expanded ? "border-slate-400" : "border-slate-300",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{section.title}</span>
        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">
          {topicCount}
        </span>
        <span aria-hidden="true" className="shrink-0 text-slate-400">
          {expanded ? "−" : "+"}
        </span>
      </button>
    </>
  );
}

export function TopicNode({ data }: NodeProps<TopicFlowNode>) {
  const { selectTopic } = use(MapNodeActionsContext);
  const { topic, selected, dimmed } = data;
  return (
    <>
      <Handles />
      <button
        type="button"
        aria-pressed={selected}
        aria-label={topicLabel(topic)}
        data-dimmed={dimmed}
        title={topic.title}
        onClick={(event) => {
          stop(event);
          selectTopic(topic.id);
        }}
        className={cx(
          "nodrag flex size-full items-center gap-2 overflow-hidden rounded-md border bg-white pr-2 text-left text-[0.8125rem] transition-opacity",
          "hover:border-slate-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700",
          topic.is_stub
            ? "border-dashed border-slate-400 text-slate-500"
            : "border-slate-300 text-slate-900",
          topic.is_overview && "border-2 bg-slate-100 font-semibold",
          selected && "border-red-700 ring-2 ring-red-700",
          dimmed && "opacity-35",
        )}
      >
        <span
          aria-hidden="true"
          className={cx("h-full w-1.5 shrink-0", LEVEL_STRIPE[topic.level])}
        />
        <span className="min-w-0 flex-1 truncate">{topic.title}</span>
        <span className="shrink-0 text-[0.6875rem] font-medium text-slate-500">
          {topic.level}
        </span>
      </button>
    </>
  );
}
