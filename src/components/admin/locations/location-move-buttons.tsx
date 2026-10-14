import { ArrowDown, ArrowUp } from "lucide-react";
import { moveLocationAction } from "@/lib/actions/admin-locations";
import { cn } from "@/lib/cn";

const buttonClass =
  "grid size-9 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-brand-50 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-35";

/** Reihenfolge ändern: ein Formular, zwei Knöpfe (funktioniert auch ohne JavaScript). */
export function LocationMoveButtons({
  id,
  name,
  canMoveUp,
  canMoveDown,
  className,
}: {
  id: string;
  name: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  className?: string;
}) {
  return (
    <form action={moveLocationAction} className={cn("flex items-center", className)}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        name="direction"
        value="up"
        disabled={!canMoveUp}
        aria-label={`${name} nach oben schieben`}
        title="Nach oben"
        className={buttonClass}
      >
        <ArrowUp className="size-4" aria-hidden />
      </button>
      <button
        type="submit"
        name="direction"
        value="down"
        disabled={!canMoveDown}
        aria-label={`${name} nach unten schieben`}
        title="Nach unten"
        className={buttonClass}
      >
        <ArrowDown className="size-4" aria-hidden />
      </button>
    </form>
  );
}
