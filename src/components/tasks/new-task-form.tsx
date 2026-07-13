"use client";

import { useState, FormEvent } from "react";
import type { Task, TaskStatus } from "@/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NewTaskForm({
  projectId,
  status,
  onCreated,
}: {
  projectId: string;
  status: TaskStatus;
  onCreated: (task: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, status }),
      });
      if (res.ok) {
        const data = await res.json();
        onCreated(data.task);
        setTitle("");
        setOpen(false);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground"
      >
        + Add task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        autoFocus
        placeholder="Task title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        required
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Adding…" : "Add"}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
