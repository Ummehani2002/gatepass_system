"use client";

import { useState, DragEvent } from "react";
import type { Task, OrgMember, TaskStatus } from "@/types";
import { TaskCard } from "./task-card";
import { NewTaskForm } from "./new-task-form";
import { TaskDetailPanel } from "./task-detail-panel";
import { cn } from "@/lib/cn";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To do" },
  { key: "in_progress", label: "In progress" },
  { key: "done", label: "Done" },
];

export function KanbanBoard({
  projectId,
  initialTasks,
  members,
}: {
  projectId: string;
  initialTasks: Task[];
  members: OrgMember[];
}) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  const membersByUserId = new Map(members.map((m) => [m.userId, m]));
  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

  function handleDrop(e: DragEvent<HTMLDivElement>, status: TaskStatus) {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain");
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === status) return;

    const previousStatus = task.status;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));

    fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((res) => {
      if (!res.ok) {
        // Roll back on failure (e.g. permission revoked mid-session).
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: previousStatus } : t)),
        );
      }
    });
  }

  function handleTaskCreated(task: Task) {
    setTasks((prev) => [...prev, task]);
  }

  function handleTaskUpdated(task: Task) {
    setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
  }

  function handleTaskDeleted(taskId: string) {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    setSelectedTaskId(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {COLUMNS.map((column) => {
        const columnTasks = tasks.filter((t) => t.status === column.key);
        return (
          <div
            key={column.key}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverColumn(column.key);
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => handleDrop(e, column.key)}
            className={cn(
              "rounded-lg border bg-muted/30 p-3 space-y-3 min-h-[200px]",
              dragOverColumn === column.key && "ring-2 ring-primary/40",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">{column.label}</h3>
              <span className="text-xs text-muted-foreground">{columnTasks.length}</span>
            </div>

            {columnTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                assignee={task.assigneeId ? membersByUserId.get(task.assigneeId) : undefined}
                onClick={() => setSelectedTaskId(task.id)}
              />
            ))}

            <NewTaskForm projectId={projectId} status={column.key} onCreated={handleTaskCreated} />
          </div>
        );
      })}

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          members={members}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={handleTaskUpdated}
          onDeleted={handleTaskDeleted}
        />
      )}
    </div>
  );
}
