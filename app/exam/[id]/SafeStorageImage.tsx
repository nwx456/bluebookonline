"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders a stored image (e.g. cropped graph from Supabase Storage) but reports
 * back when the image fails to load or comes in under a usable size, so the
 * caller can fall back to live PDF rendering instead of showing a broken/empty box.
 */
export default function SafeStorageImage({
  src,
  alt,
  className,
  minNaturalWidth = 64,
  minNaturalHeight = 64,
  onUnusable,
}: {
  src: string;
  alt: string;
  className?: string;
  minNaturalWidth?: number;
  minNaturalHeight?: number;
  onUnusable?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const reportedRef = useRef(false);

  const report = () => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    setFailed(true);
    onUnusable?.();
  };

  useEffect(() => {
    setFailed(false);
    reportedRef.current = false;
  }, [src]);

  if (failed) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("max-w-full h-auto block object-contain w-full", className)}
      onLoad={(e) => {
        const img = e.currentTarget;
        if (
          img.naturalWidth < minNaturalWidth ||
          img.naturalHeight < minNaturalHeight
        ) {
          report();
        }
      }}
      onError={() => {
        report();
      }}
    />
  );
}
