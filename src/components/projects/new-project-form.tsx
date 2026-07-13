"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NewProjectForm({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setName("");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>New project</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-2">
      <div>
        <Input
          autoFocus
          placeholder="Project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Creating…" : "Create"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </form>
  );
}
