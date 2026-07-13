"use client";

import { useEffect, useState, FormEvent } from "react";
import type { Task, OrgMember, Comment, TaskStatus, TaskPriority } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "To do" },
  { value: "in_progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

export function TaskDetailPanel({
  task,
  members,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: Task;
  members: OrgMember[];
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
}) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingComments(true);
    fetch(`/api/tasks/${task.id}/comments`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setComments(data.comments ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [task.id]);

  async function updateField(patch: Partial<Task>) {
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      const data = await res.json();
      onUpdated(data.task);
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this task? This can't be undone.")) return;
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    if (res.ok) onDeleted(task.id);
  }

  async function handleAddComment(e: FormEvent) {
    e.preventDefault();
    if (!newComment.trim()) return;
    setPosting(true);

    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newComment }),
      });
      if (res.ok) {
        const data = await res.json();
        setComments((prev) => [...prev, data.comment]);
        setNewComment("");
      }
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold">{task.title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Status</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={task.status}
              onChange={(e) => updateField({ status: e.target.value as TaskStatus })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-muted-foreground mb-1">Priority</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={task.priority}
              onChange={(e) => updateField({ priority: e.target.value as TaskPriority })}
            >
              {PRIORITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm col-span-2">
            <span className="block text-muted-foreground mb-1">Assignee</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={task.assigneeId ?? ""}
              onChange={(e) => updateField({ assigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 border-t pt-4">
          <h3 className="text-sm font-medium mb-2">Comments</h3>
          {loadingComments ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((c) => (
                <li key={c.id} className="text-sm">
                  <span className="font-medium">{c.author.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">
                    {new Date(c.createdAt).toLocaleString()}
                  </span>
                  <p className="mt-0.5">{c.body}</p>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={handleAddComment} className="mt-4 flex gap-2">
            <Input
              placeholder="Add a comment…"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={posting}>
              Post
            </Button>
          </form>
        </div>

        <div className="mt-6 border-t pt-4">
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            Delete task
          </Button>
        </div>
      </div>
    </div>
  );
}
