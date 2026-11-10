import type { Level } from "../api/types.ts";

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className="rounded-md bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white">
      {level}
    </span>
  );
}
