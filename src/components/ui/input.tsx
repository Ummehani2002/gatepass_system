import { InputHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/cn";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border bg-background px-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
