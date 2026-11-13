import { BaseEdge, Position, type EdgeProps } from "@xyflow/react";
import { arcPath, type ArcFlowEdge } from "../lib/mapFlow.ts";

/* Линии карты тем, которых нет в React Flow: дуга между узлами одного столбца. */

/** Дуга между узлами одного столбца: выгнута наружу, к стороне точек крепления. */
export function ArcEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  style,
  markerEnd,
  interactionWidth,
}: EdgeProps<ArcFlowEdge>) {
  return (
    <BaseEdge
      path={arcPath(
        { x: sourceX, y: sourceY },
        { x: targetX, y: targetY },
        sourcePosition === Position.Left ? -1 : 1,
      )}
      {...(style === undefined ? {} : { style })}
      {...(markerEnd === undefined ? {} : { markerEnd })}
      {...(interactionWidth === undefined ? {} : { interactionWidth })}
    />
  );
}
