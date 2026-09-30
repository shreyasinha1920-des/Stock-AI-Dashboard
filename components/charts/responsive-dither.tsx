"use client";

import { useEffect, useRef, useState } from "react";
import DitherChart, { type DitherChartProps } from "@/components/ui/smoothui/dither-chart";
import { cn } from "@/lib/utils";

/**
 * SmoothUI's DitherChart takes a fixed pixel width. This measures its box and
 * feeds the width in, so charts fill fluid layouts. The height is reserved up
 * front, so nothing shifts while the width is measured.
 */
export function ResponsiveDither({
  className,
  height,
  ...props
}: Omit<DitherChartProps, "width"> & { height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const measure = () => setWidth(Math.floor(node.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={cn("w-full", className)} style={{ height }}>
      {width > 0 ? (
        <DitherChart {...props} className="flex" height={height} width={width} />
      ) : null}
    </div>
  );
}
