import { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type Tone = "default" | "low" | "medium" | "high";

const toneClasses: Record<Tone, string> = {
  default: "bg-muted text-muted-foreground",
  low: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
