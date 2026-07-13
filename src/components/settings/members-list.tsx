"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
}

export function MembersList({
  organizationId,
  initialMembers,
}: {
  organizationId: string;
  initialMembers: Member[];
}) {
  const router = useRouter();
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAdding(true);

    try {
      const res = await fetch(`/api/organizations/${organizationId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role: "member" }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      setEmail("");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(memberId: string) {
    if (!confirm("Remove this member from the organization?")) return;
    const res = await fetch(`/api/organizations/${organizationId}/members/${memberId}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <ul className="divide-y rounded-md border">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-medium">{member.name}</p>
              <p className="text-xs text-muted-foreground">{member.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge>{member.role}</Badge>
              {member.role !== "owner" && (
                <button
                  onClick={() => handleRemove(member.id)}
                  className="text-xs text-destructive hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input
          type="email"
          placeholder="teammate@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" disabled={adding}>
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">
        They need an existing TaskFlow account with this email — invite-by-email signup is on the roadmap.
      </p>
    </div>
  );
}
