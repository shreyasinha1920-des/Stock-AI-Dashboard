"use client";

import type { ReactNode } from "react";
import { useAI } from "@/components/ai/ai-provider";
import { cn } from "@/lib/utils";

/**
 * One hairline cell of the dashboard grid. While the conversation is open,
 * cells the answer talks about light up; every other cell dims under the
 * dither veil.
 */
export function Cell({
  id,
  title,
  action,
  className,
  children,
}: {
  id: string;
  title: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { open, highlights, spotlight } = useAI();
  const lit = (open && highlights.has(id)) || spotlight === id;

  return (
    <section
      aria-labelledby={`${id}-title`}
      className={cn("cell flex flex-col gap-6 p-6 max-md:p-4", className)}
      data-dimmed={open && !lit}
      data-lit={lit}
      id={id}
    >
      <header className="flex min-h-8 flex-wrap items-center justify-between gap-3">
        <h2 className="font-medium text-[15px] text-ink" id={`${id}-title`}>
          {title}
        </h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Delta({
  value,
  children,
  className,
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "num",
        value > 0.0001 ? "text-up" : value < -0.0001 ? "text-down" : "text-ink-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
