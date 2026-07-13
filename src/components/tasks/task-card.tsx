"use client";

import { DragEvent } from "react";
import { Badge } from "@/components/ui/badge";
import type { Task, OrgMember } from "@/types";

const PRIORITY_TONE = { low: "low", medium: "medium", high: "high" } as const;

export function TaskCard({
  task,
  assignee,
  onClick,
}: {
  task: Task;
  assignee?: OrgMember;
  onClick: () => void;
}) {
  function handleDragStart(e: DragEvent<HTMLDivElement>) {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  }

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onClick={onClick}
      className="cursor-pointer rounded-md border bg-card p-3 shadow-sm hover:border-primary/50 transition-colors"
    >
      <p className="text-sm font-medium">{task.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority}</Badge>
        {assignee && (
          <span className="text-xs text-muted-foreground" title={assignee.name}>
            {assignee.name
              .split(" ")
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}
