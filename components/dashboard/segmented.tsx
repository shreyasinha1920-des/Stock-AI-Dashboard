"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Compact segmented control built on shadcn Tabs (Base UI underneath). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <Tabs onValueChange={(next) => onChange(next as T)} value={value}>
      <TabsList
        aria-label={label}
        className="h-8 gap-0 rounded-[8px] border border-edge bg-transparent p-0.5"
      >
        {options.map((option) => (
          <TabsTrigger
            className="h-7 rounded-[6px] px-2.5 text-[12px] text-ink-2 transition-colors duration-150 hover:text-ink data-active:bg-raised data-active:text-ink data-active:shadow-none dark:data-active:border-transparent dark:data-active:bg-raised"
            key={option}
            value={option}
          >
            {option}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
