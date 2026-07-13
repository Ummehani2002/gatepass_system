"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function OrgSettingsForm({
  organizationId,
  initialName,
  initialSlug,
}: {
  organizationId: string;
  initialName: string;
  initialSlug: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const res = await fetch(`/api/organizations/${organizationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, slug }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      router.push(`/${data.organization.slug}/settings`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 max-w-sm">
      <label className="text-sm block">
        <span className="block text-muted-foreground mb-1">Organization name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="text-sm block">
        <span className="block text-muted-foreground mb-1">URL slug</span>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} required />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
