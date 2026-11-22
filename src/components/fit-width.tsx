"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shows fixed-width A4 pages scaled down to fit a phone screen. Uses a CSS transform on a wrapper,
 * so the pages themselves keep their real size for PDF / image export.
 */
export function FitWidth({ width, children }: { width: number; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    const update = () => {
      const avail = outer.current?.clientWidth ?? width;
      const s = Math.min(1, avail / width);
      setScale(s);
      setHeight(inner.current ? inner.current.scrollHeight * s : undefined);
    };
    update();
    const ro = new ResizeObserver(update);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="w-full overflow-hidden" style={{ height }}>
      <div ref={inner} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
  );
}
