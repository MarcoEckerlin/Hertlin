"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Wurde im Browser schon einmal eine Seite angezeigt? Erst danach blenden Seitenwechsel weich ein. */
let shownBefore = false;

/**
 * Seitenwechsel auf der Website: Der neue Inhalt blendet kurz ein (200 ms), statt hart umzuspringen.
 * Beim ersten Aufruf der Website bleibt der Inhalt sofort stehen. Bei „weniger Bewegung“ entfällt die Blende.
 */
export default function SiteTemplate({ children }: { children: ReactNode }) {
  const [fade] = useState(() => typeof window !== "undefined" && shownBefore);
  useEffect(() => {
    shownBefore = true;
  }, []);
  return (
    <div
      className={
        fade
          ? "*:transition-opacity *:duration-200 *:ease-out *:starting:opacity-0 motion-reduce:*:transition-none"
          : undefined
      }
    >
      {children}
    </div>
  );
}
